import { sendError } from '../../../../sendError.js'
import getExtension from '../getExtension.js'
import { BasedServer } from '../../../../server.js'
import {
  BasedDataStream,
  BasedRoute,
  Context,
  HttpSession,
  StreamPayload,
} from '../../../../../functions/index.js'
import { BasedErrorCode } from '../../../../../errors/index.js'

const MAX_CHUNK_SIZE = 1024 * 1024 * 5

export type FileOptions = {
  name?: string
  size?: number
  type: string
  extension: string
  payload: any
}

type FileDescriptor = {
  opts: Partial<FileOptions>
  stream: BasedDataStream
  isDone: boolean
  headersSet: number
}

// only use this if you have an individual file else its just all
const setHeader = (file: FileDescriptor): boolean => {
  file.headersSet++
  if (file.headersSet === 2) {
    return true
  }
  return false
}

const toBuffer = (str: string, firstWritten: boolean): Buffer => {
  return Buffer.from(firstWritten ? str + '\r\n' : str, 'binary')
}

const handleMeta = (
  file: FileDescriptor,
  line: string,
  meta: string,
  isWriting: boolean,
  fileCallback: (payload: StreamPayload) => void,
): boolean => {
  const opts = file.opts
  opts.name = line.match(/filename="(.*?)"/)?.[1] || 'untitled'
  const firstCommaIndex = meta.indexOf(',')
  if (firstCommaIndex !== -1 && meta.startsWith('size=')) {
    const size = meta.slice(5, firstCommaIndex)
    if (size) {
      const sizeNr = Number(size) // + 2
      file.opts.size = sizeNr
      file.stream.size = sizeNr
    }
    const payloadRaw = decodeURI(meta.slice(firstCommaIndex + 1))
    if (payloadRaw !== undefined && payloadRaw !== '') {
      try {
        file.opts.payload = JSON.parse(payloadRaw)
      } catch (err) {
        file.opts.payload = payloadRaw
      }
    }
  }
  isWriting = setHeader(file)
  if (isWriting) {
    fileCallback({
      payload: file.opts.payload || {},
      fileName: file.opts.name,
      mimeType: file.opts.type!,
      extension: file.opts.extension,
      size: file.opts.size || 0,
      stream: file.stream,
    })
  }
  return isWriting
}

export default (
  ctx: Context<HttpSession>,
  server: BasedServer,
  route: BasedRoute<'stream'>,
  onFile: (payload: StreamPayload) => void,
  isReady: () => void,
) => {
  const files: FileDescriptor[] = []
  const session = ctx.session!
  const contentLength = session.headers['content-length']!

  let setInProgress = false
  let boundary: string
  let prevLine: string | null
  let isWriting = false
  let collectMeta: string
  let total = 0
  let progress = 0

  session.res.onData((chunk, isLast) => {
    // see if this goes ok... (clearing mem etc)
    if (chunk.byteLength > MAX_CHUNK_SIZE) {
      sendError(server, ctx, BasedErrorCode.ChunkTooLarge, route)
      for (const file of files) {
        file.stream.destroy()
      }
      return
    }

    let firstWritten = false
    const blocks = Buffer.from(chunk).toString('binary').split('\r\n')
    total += chunk.byteLength

    progress = total / contentLength

    for (const file of files) {
      if (file.headersSet > 1 && !file.isDone && !file.opts.size) {
        if (contentLength > 200000) {
          if (!setInProgress) {
            setInProgress = true
            setTimeout(() => {
              for (const file of files) {
                if (file.headersSet > 1 && !file.isDone && !file.opts.size) {
                  if (progress === 1) {
                    file.isDone = true
                  }
                }
              }
              setInProgress = false
            }, 250)
          }
          break
        }
      }
    }

    if (!boundary) {
      boundary = blocks[0]
    }

    for (let i = 0; i < blocks.length; i++) {
      const line = blocks[i]

      if (!boundary) {
        continue
      }

      if (isWriting && (line === boundary || line === boundary + '--')) {
        isWriting = false
        const file = files[files.length - 1]
        if (prevLine) {
          file.stream.end(toBuffer(prevLine, firstWritten))
        } else {
          file.stream.end()
        }
        file.isDone = true
        prevLine = null
        if (line === boundary + '--') {
          continue
        }
      }

      if (line === boundary && !isWriting) {
        const file = {
          stream: new BasedDataStream(0),
          headersSet: 0,
          opts: {},
          isDone: false,
        }
        files.push(file)
        continue
      }

      const file = files[files.length - 1]

      if (!file) {
        // TODO: invalid file error
        return sendError(server, ctx, BasedErrorCode.InvalidPayload, { route })
      }

      if (!isWriting && collectMeta) {
        const fullMeta = collectMeta + line
        const meta = fullMeta.match(/name="(.*?)"/)?.[1]
        if (!meta) {
          collectMeta = fullMeta
          continue
        }
        collectMeta = ''
        isWriting = handleMeta(file, line, meta, isWriting, onFile)
        continue
      }

      if (!collectMeta && !isWriting && line.includes('Content-Disposition')) {
        const meta = line.match(/name="(.*?)"/)?.[1]
        if (!meta) {
          if (/name="(.*?)/.test(line)) {
            collectMeta = line
            continue
          }
          // TODO: invalid file error
          return sendError(server, ctx, BasedErrorCode.InvalidPayload, {
            route,
          })
        }
        isWriting = handleMeta(file, line, meta, isWriting, onFile)
        continue
      }

      if (!isWriting && line.includes('Content-Type')) {
        const mimeType = line.match(
          /Content-Type: ([a-zA-Z0-9].+\/[a-zA-Z0-9].+)/,
        )?.[1]
        if (!mimeType) {
          // TODO: invalid file (can speficy in route potentialy...)
          return sendError(server, ctx, BasedErrorCode.InvalidPayload, {
            route,
          })
        }

        file.opts.type = mimeType
        const extension = getExtension(mimeType)
        if (extension) {
          file.opts.extension = extension
        }

        isWriting = setHeader(file)
        if (isWriting) {
          onFile({
            payload: file.opts.payload,
            fileName: file.opts.name,
            mimeType: file.opts.type,
            extension: file.opts.extension,
            size: file.opts.size!,
            stream: file.stream,
          })
        }
        continue
      }

      if (isWriting) {
        if (prevLine) {
          file.stream.write(toBuffer(prevLine, firstWritten))
        }
        prevLine = line
        firstWritten = true
      }
    }

    if (isLast) {
      isReady()
    }
  })
}
