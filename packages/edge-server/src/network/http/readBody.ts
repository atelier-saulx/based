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
      // unfortunately need to make a copy of the data and decompress in the main thread
      const chunks: Buffer[] = []
      // will prob not work because shared data in uws
      let len = 0
      uncompressStream.on('data', (c) => {
        chunks.push(c)
        len += c.byteLength
      })
      let i = 0
      uncompressStream.on('end', () => {
        uncompressStream.destroy()
        const data: SharedArrayBuffer = new SharedArrayBuffer(len)
        const buf = new Uint8Array(data)
        for (const c of chunks) {
          buf.set(c, i)
          i += c.byteLength
        }
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

      buf.set(new Uint8Array(c), index)
      index += len

      if (isLast) {
        console.info('shared buf time', buf)
        onData(buf)
      }
    })
  }
}
