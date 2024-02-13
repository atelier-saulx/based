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
  options: StreamFunctionPath
) => {
  const info = await checkFile(options.path)
  if (info) {
    return uploadFileStream(client, name, {
      contents: fs.createReadStream(options.path),
      mimeType: options.mimeType,
      extension: options.path.match(/\.(.*?)$/)?.[1],
      size: info.size,
      payload: options.payload,
      serverKey: options.serverKey,
    })
  } else {
    throw new Error(`File does not exist ${options.path}`)
  }
}

export const uploadFileStream = async (
  client: BasedClient,
  name: string,
  options: StreamFunctionStream
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
  let totalRead = 0

  // while (totalRead !== options.size) {
  //   const r = options.contents.read(readSize)

  //   console.log(r)

  //   // addStreamChunk(this, reqId, ++seqId, chunk)

  //   totalRead += readSize
  // }

  // const wr = new WritableStream(
  //   {
  //     write: () => {
  //       console.log('bla')
  //     },
  //     close() {},
  //     abort(err) {},
  //   },
  //   new CountQueuingStrategy({ highWaterMark: 1 })
  // )

  /*
stream.cork();
stream.write('some ');
stream.write('data ');
process.nextTick(() => stream.uncork()); 
    */

  let isCorked = false

  let r = 0

  let bufferSize = 0
  let chunks: any[] = []

  let totalHandler = 0

  const wr = new Writable({
    write: function (c, encoding, next) {
      bufferSize += c.byteLength
      chunks.push(c)

      if (totalHandler + bufferSize === options.size) {
        const n = new Uint8Array(bufferSize)
        let c = 0
        for (const b of chunks) {
          n.set(b, c)
          c += b.length
        }
        totalHandler += bufferSize
        addStreamChunk(client, reqId, ++seqId, n)
        bufferSize = 0
        chunks = []
        next()

        // END
      } else if (bufferSize >= readSize) {
        setTimeout(() => {
          const n = new Uint8Array(bufferSize)
          let c = 0
          for (const b of chunks) {
            n.set(b, c)
            c += b.length
          }
          totalHandler += bufferSize
          addStreamChunk(client, reqId, ++seqId, n)
          bufferSize = 0
          chunks = []
          next()

          // here we are going to wait for a reply
        }, 0)
      } else {
        next()
      }
    },
  })

  // wr.on('drain', () => {
  //   console.log('DRAIN')
  // })

  // wr.on('pipe', () => {
  //   console.log('flap pipe')
  // })

  // wr.on('unpipe', () => {
  //   console.log('flap pipe stop')
  // })

  // wr.on('error', (err) => {
  //   console.log(err)
  // })

  // wr.on('end', () => {
  //   console.log('END')
  // })

  options.contents.pipe(wr)

  return new Promise((resolve, reject) => {
    client.streamFunctionResponseListeners.set(reqId, [resolve, reject])
  })
}
