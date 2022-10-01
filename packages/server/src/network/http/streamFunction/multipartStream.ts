import { DataStream } from './DataStream'
import { BasedServer } from '../../..'
import { HttpClient, BasedFunctionSpec } from '../../../types'
import { BasedErrorCode } from '../../../error'
import { sendHttpError } from '../send'
import getExtension from './getExtension'
import endStreamRequest from './endStreamRequest'

export type FileOptions = {
  name?: string
  size: number
  type: string
  extension: string
  disposition: string[]
  meta: { size?: number } & { [key: string]: string }
}

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

export default async (
  server: BasedServer,
  client: HttpClient,
  payload: any,
  fn: BasedFunctionSpec
): Promise<void> => {
  // multi file...

  if (!payload || (!payload && typeof payload !== 'object')) {
    payload = {}
  }

  const files: FileDescriptor[] = []

  const contentLength = client.context.headers['content-length']

  let boundary = null
  let prevLine: string
  let isWriting = false
  let total = 0

  client.res.onData((chunk, isLast) => {
    let firstWritten = false
    const blocks = Buffer.from(chunk).toString('binary').split('\r\n')
    total += chunk.byteLength

    for (const file of files) {
      if (file.headersSet > 1 && !file.isDone && !file.opts.meta.size) {
        file.stream.emit('progress', total / contentLength)
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
        if (!file.opts.meta.size) {
          file.stream.emit('progress', 1)
        }
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
        return sendHttpError(client, BasedErrorCode.InvalidPayload)
      }

      if (!isWriting && line.includes('Content-Disposition')) {
        const meta = line.match(/name="(.*?)"/)?.[1]
        if (!meta) {
          // TODO: invalid file
          return sendHttpError(client, BasedErrorCode.InvalidPayload)
        }

        const opts = file.opts

        opts.name = line.match(/filename="(.*?)"/)?.[1] || 'untitled'
        opts.disposition = meta.split('|')
        opts.meta = {}
        for (const seg of opts.disposition) {
          if (/=/.test(seg)) {
            const [k, v] = seg.split('=')
            if (k === 'size') {
              opts.meta[k] = Number(v)
            } else {
              opts.meta[k] = v
            }
          }
        }

        if (opts.meta.size) {
          streamProgress(file.stream, opts.meta.size)
        }

        isWriting = setHeader(file)
        if (isWriting === null) {
          return
        } else {
          fn.function(
            { payload: { ...payload, ...opts }, stream: file.stream },
            client
          ).catch(() => {})
        }
        continue
      }

      if (!isWriting && line.includes('Content-Type')) {
        const mimeType = line.match(
          /Content-Type: ([a-zA-Z0-9].+\/[a-zA-Z0-9].+)/
        )?.[1]
        if (!mimeType) {
          // TODO: invalid file
          return sendHttpError(client, BasedErrorCode.InvalidPayload)
        }
        file.opts.type = mimeType
        file.opts.extension = getExtension(mimeType)
        isWriting = setHeader(file)
        if (isWriting === null) {
          return
        } else {
          fn.function(
            { payload: { ...payload, ...file.opts }, stream: file.stream },
            client
          ).catch(() => {})
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
      endStreamRequest(client)
    }
  })
}
