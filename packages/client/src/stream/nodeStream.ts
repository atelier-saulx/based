import { Readable, Writable } from 'stream'
import fs from 'fs'
import { promisify } from 'util'
import {
  StreamFunctionPath,
  StreamFunctionStream,
  StreamResponseHandler,
} from './types.js'
import { BasedClient } from '../index.js'
import { addStreamChunk, addStreamRegister } from '../outgoing/index.js'

const stat = promisify(fs.stat)

const checkFile = async (path: string): Promise<{ size: number } | null> => {
  try {
    const s = await stat(path)
    return {
      size: s.size,
    }
  } catch (err) {}
}

export const isStream = (contents: any): contents is Readable => {
  return contents instanceof Readable
}

export const uploadFilePath = async (
  client: BasedClient,
  name: string,
  options: StreamFunctionPath,
  progressListener?: (p: number, bytes: number) => void
) => {
  const info = await checkFile(options.path)
  if (info) {
    return uploadFileStream(
      client,
      name,
      {
        contents: fs.createReadStream(options.path),
        mimeType: options.mimeType,
        extension: options.path.match(/\.(.*?)$/)?.[1],
        size: info.size,
        payload: options.payload,
        serverKey: options.serverKey,
      },
      progressListener
    )
  } else {
    throw new Error(`File does not exist ${options.path}`)
  }
}

export const uploadFileStream = async (
  client: BasedClient,
  name: string,
  options: StreamFunctionStream,
  progressListener?: (p: number, bytes: number) => void
): Promise<any> => {
  if (!(options.contents instanceof Readable)) {
    throw new Error('File Contents has to be an instance of "Readable"')
  }

  if (!client.connected) {
    await client.once('connect')
  }

  let reqId = ++client.streamRequestId

  if (reqId > 16777215) {
    reqId = 0
  }

  let seqId = 0

  addStreamRegister(
    client,
    reqId,
    options.size,
    options.fileName,
    options.mimeType,
    options.extension,
    name,
    options.payload
  )

  // // 100kb
  const smallest = 100000

  // // 3mb
  const maxSize = 1000000 * 3 // 3 mb

  // 1mb
  const medium = 1000000

  let readSize = Math.min(medium, options.size)
  if (options.size < medium * 10) {
    readSize = Math.min(smallest, options.size)
  }

  let bufferSize = 0

  let chunks: any[] = []

  let totalBytes = 0

  let streamHandler: StreamResponseHandler

  client.once('disconnect', () => {
    console.error('CLIENT DC -> ABORT STREAM')
  })

  const wr = new Writable({
    write: function (c, encoding, next) {
      if (c.byteLength > maxSize) {
        console.log('LARGER THEN MAX SIZE HANDLE!', c.byteLength, maxSize)
      }

      bufferSize += c.byteLength

      // TODO: handle encoding?
      // console.info(encoding)
      // only deflate ;?

      chunks.push(c)

      if (bufferSize >= readSize || totalBytes + bufferSize === options.size) {
        const cb = (_, code: number) => {
          if (code === 1) {
            progressListener(1, options.size)
          } else {
            const n = new Uint8Array(bufferSize)
            let c = 0
            for (const b of chunks) {
              n.set(b, c)
              c += b.length
            }
            if (progressListener) {
              progressListener(totalBytes / options.size, totalBytes)
            }
            totalBytes += bufferSize
            addStreamChunk(client, reqId, ++seqId, n)
            bufferSize = 0
            chunks = []
            next()
          }
        }

        if (seqId > 0) {
          streamHandler[2] = cb
        } else {
          // start
          setTimeout(cb, 0)
        }
      } else {
        next()
      }
    },
  })

  options.contents.pipe(wr)

  return new Promise((resolve, reject) => {
    streamHandler = [resolve, reject, () => {}]
    client.streamFunctionResponseListeners.set(reqId, streamHandler)
  })
}
