import { Readable, Writable } from 'stream'
import fs from 'fs'
import { promisify } from 'util'
import { StreamFunctionPath, StreamFunctionStream } from './types.js'
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
  progressListener?: (p: number) => void
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
  progressListener?: (p: number) => void
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
    name,
    options.payload
  )

  // 1MB 1000000
  const readSize = Math.min(1000000, options.size)

  let bufferSize = 0
  let chunks: any[] = []

  let totalHandler = 0

  let sHandler

  const wr = new Writable({
    write: function (c, encoding, next) {
      if (totalHandler === options.size) {
        console.info('all written done!')
        return
      }

      if (progressListener && totalHandler === 0 && bufferSize === 0) {
        progressListener(0)
      }

      bufferSize += c.byteLength
      chunks.push(c)

      // keep them smaller then max size as well (now 1 mb min only)

      if (
        bufferSize >= readSize ||
        totalHandler + bufferSize === options.size
      ) {
        const cb = (_, code: number) => {
          if (code === 1) {
            progressListener(1)
          } else {
            const n = new Uint8Array(bufferSize)
            let c = 0
            for (const b of chunks) {
              n.set(b, c)
              c += b.length
            }
            if (progressListener) {
              progressListener(totalHandler / options.size)
            }
            totalHandler += bufferSize
            addStreamChunk(client, reqId, ++seqId, n)
            bufferSize = 0
            chunks = []
            next()
          }
        }

        if (seqId > 0) {
          sHandler[2] = cb
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
    sHandler = [resolve, reject, () => {}]
    client.streamFunctionResponseListeners.set(reqId, sHandler)
  })
}
