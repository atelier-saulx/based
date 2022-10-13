import { BasedFunctionRoute, HttpClient } from '../../types'
import zlib from 'node:zlib'
import { sendHttpError } from './send'
import { BasedErrorCode } from '../../error'
import { BasedServer } from '../../server'

const MAX_CHUNK_SIZE = 1024 * 1024

const UNCOMPRESS_OPTS = {
  // can be endless scince we limit by incoming
  chunkSize: 1024 * 1024 * 1000,
}

// export const parseData = (
//   // server: BasedServer,
//   context: ClientContext,
//   // client: HttpClient,
//   // contentType: string,
//   data: SharedArrayBuffer,
//   // route: BasedFunctionRoute
// ): any => {
//   // has to happen somehwere else...
//   // authorize???? - we want to check the payload so authorize HAS TO RUN IN THE WORKER

//   const contentType = context.headers['content-type']

//   if (contentType === 'application/json' || !contentType) {
//     const str = data.toString()
//     let parsedData: any
//     try {
//       parsedData = data.byteLength ? JSON.parse(str) : undefined
//       return parsedData
//     } catch (e) {
//       // make this an event
//       // has to buble up
//       // sendHttpError(server, client, BasedErrorCode.InvalidPayload, route)
//     }
//   } else if (
//     contentType.startsWith('text') ||
//     contentType === 'application/xml'
//   ) {
//     return data.toString()
//   } else {
//     return data
//   }
// }

export const readBody = (
  server: BasedServer,
  client: HttpClient,
  onData: (data: any | void) => void,
  route: BasedFunctionRoute
) => {
  if (!client.res) {
    return
  }

  const contentLen = client.context.headers['content-length']

  if (contentLen > route.maxPayloadSize) {
    sendHttpError(server, client, BasedErrorCode.PayloadTooLarge, route)
    return
  }

  // const contentType = client.context.headers['content-type']
  const contentEncoding = client.context.headers['content-encoding']
  let size = 0

  if (contentEncoding) {
    let uncompressStream: zlib.Deflate | zlib.Gunzip
    if (contentEncoding === 'deflate') {
      uncompressStream = zlib.createInflate(UNCOMPRESS_OPTS)
    } else if (contentEncoding === 'gzip') {
      uncompressStream = zlib.createGunzip(UNCOMPRESS_OPTS)
    } else if (contentEncoding === 'br') {
      uncompressStream = zlib.createBrotliDecompress(UNCOMPRESS_OPTS)
    }
    if (uncompressStream) {
      client.res.onData((c, isLast) => {
        size += c.byteLength
        if (size > route.maxPayloadSize) {
          sendHttpError(server, client, BasedErrorCode.PayloadTooLarge, route)
          // sendHttpError(client, 'Payload Too Large', 413)
          uncompressStream.destroy()
          return
        }
        if (c.byteLength > MAX_CHUNK_SIZE) {
          sendHttpError(server, client, BasedErrorCode.ChunkTooLarge, route)
          uncompressStream.destroy()
          return
        }
        const buf = Buffer.alloc(c.byteLength, Buffer.from(c))
        if (isLast) {
          uncompressStream.end(buf)
        } else {
          if (!uncompressStream.write(buf)) {
            // handle backpressure
          }
        }
      })
      const data: SharedArrayBuffer = new SharedArrayBuffer(contentLen)
      const buf = new Uint8Array(data)
      let index = 0

      uncompressStream.on('data', (c) => {
        const len = c.byteLength
        for (let i = 0; i < len; i++) {
          Atomics.store(buf, index, c[i])
        }
        index += len
      })
      uncompressStream.on('end', () => {
        uncompressStream.destroy()
        // parseData(server, client, contentType, data, false, route)
        onData(buf)
      })
    } else {
      sendHttpError(server, client, BasedErrorCode.InvalidPayload, route)
    }
  } else {
    const data: SharedArrayBuffer = new SharedArrayBuffer(contentLen)
    const buf = new Uint8Array(data)
    let index = 0
    client.res.onData((c, isLast) => {
      const len = c.byteLength

      size += len
      if (size > route.maxPayloadSize) {
        sendHttpError(server, client, BasedErrorCode.PayloadTooLarge, route)
        return
      }
      if (c.byteLength > MAX_CHUNK_SIZE) {
        sendHttpError(server, client, BasedErrorCode.ChunkTooLarge, route)
        return
      }

      for (let i = 0; i < len; i++) {
        Atomics.store(buf, index, c[i])
      }
      index += len

      if (isLast) {
        onData(buf)
      }
    })
  }
}
