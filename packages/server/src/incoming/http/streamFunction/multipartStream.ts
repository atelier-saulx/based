import { DataStream } from './DataStream'
import { HttpSession, Context } from '@based/functions'
import { BasedErrorCode } from '../../../error'
import { sendError } from '../../../sendError'
import { sendHttpResponse } from '../../../sendHttpResponse'
import getExtension from './getExtension'
import { BasedServer } from '../../../server'
import { BasedFunctionRoute } from '../../../functions'

const MAX_CHUNK_SIZE = 1024 * 1024 * 5

export type FileOptions = {
  name?: string
  size?: number
  type: string
  extension: string
} & { [key: string]: string }

type FileDescriptor = {
  opts: Partial<FileOptions>
  stream: DataStream
  isDone: boolean
  headersSet: number
}

const streamProgress = (stream: DataStream, size: number) => {
  stream.emit('progress', 0)
  if (size < 200000) {
    stream.on('end', () => {
      stream.emit('progress', 1)
    })
  } else {
    let progress = 0
    let total = 0
    let setInProgress = false
    const updateProgress = () => {
      if (!setInProgress) {
        setInProgress = true
        setTimeout(() => {
          stream.emit('progress', progress)
          setInProgress = false
        }, 250)
      }
    }
    stream.on('end', () => {
      progress = 1
      updateProgress()
    })
    stream.on('data', (chunk) => {
      total += chunk.byteLength
      progress = total / size
      updateProgress()
    })
  }
}

// only use this if you have individual file else its just all
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

export default (
  ctx: Context<HttpSession>,
  server: BasedServer,
  payload: any,
  route: BasedFunctionRoute,
  fn: (payload: any) => Promise<any>
) => {
  if (!payload || (!payload && typeof payload !== 'object')) {
    payload = {}
  }

  const files: FileDescriptor[] = []

  const contentLength = ctx.session.headers['content-length']

  const promiseQ: Promise<any>[] = []

  let setInProgress = false
  let boundary = null
  let prevLine: string
  let isWriting = false
  let total = 0
  let progress = 0

  ctx.session.res.onData((chunk, isLast) => {
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
                  file.stream.emit('progress', progress)
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
        if (!file.opts.size && !file.isDone) {
          file.stream.emit('progress', 1)
        }
        file.isDone = true

        prevLine = null
        if (line === boundary + '--') {
          continue
        }
      }

      if (line === boundary && !isWriting) {
        const file = {
          stream: new DataStream(),
          headersSet: 0,
          opts: {},
          isDone: false,
        }
        files.push(file)
        continue
      }

      const file = files[files.length - 1]

      if (!file) {
        // TODO: invalid file
        return sendError(server, ctx, BasedErrorCode.InvalidPayload, route)
      }

      if (!isWriting && line.includes('Content-Disposition')) {
        const meta = line.match(/name="(.*?)"/)?.[1]
        if (!meta) {
          // TODO: invalid file
          return sendError(server, ctx, BasedErrorCode.InvalidPayload, route)
        }
        const opts = file.opts
        opts.name = line.match(/filename="(.*?)"/)?.[1] || 'untitled'
        const disposition = meta.split('|')
        for (const seg of disposition) {
          if (/=/.test(seg)) {
            const [k, v] = seg.split('=')
            if (k === 'size') {
              opts[k] = Number(v)
            } else {
              opts[k] = v
            }
          }
        }
        if (opts.size) {
          streamProgress(file.stream, opts.size)
        }
        isWriting = setHeader(file)
        if (isWriting) {
          promiseQ.push(
            fn({ payload: { ...payload, ...file.opts }, stream: file.stream })
          )
        }
        continue
      }

      if (!isWriting && line.includes('Content-Type')) {
        const mimeType = line.match(
          /Content-Type: ([a-zA-Z0-9].+\/[a-zA-Z0-9].+)/
        )?.[1]
        if (!mimeType) {
          // TODO: invalid file (can speficy in route potentialy...)
          return sendError(server, ctx, BasedErrorCode.InvalidPayload, route)
        }
        file.opts.type = mimeType
        file.opts.extension = getExtension(mimeType)
        isWriting = setHeader(file)
        if (isWriting) {
          promiseQ.push(
            fn({ payload: { ...payload, ...file.opts }, stream: file.stream })
          )
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
      Promise.allSettled(promiseQ).then((results) => {
        const r = results.map((v) => {
          if (v.status === 'rejected') {
            return { err: v.reason }
          } else {
            return v.value
          }
        })
        sendHttpResponse(ctx, r)
      })
    }
  })
}
