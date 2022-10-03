import { HttpClient } from '../../types'
import zlib from 'node:zlib'
import { sendHttpError } from './send'
import { BasedErrorCode } from '../../error'
import { BasedServer } from '../../server'

const MAX_CHUNK_SIZE = 1024 * 1024

const UNCOMPRESS_OPTS = {
  // can be endless scince we limit by incoming
  chunkSize: 1024 * 1024 * 1000,
}

const parseData = (
  server: BasedServer,
  client: HttpClient,
  contentType: string,
  data: Buffer,
  rawBuffer: boolean
): any => {
  if (contentType === 'application/json' || !contentType) {
    const str = data.toString()
    let params
    try {
      params = data.length ? JSON.parse(str) : undefined
      return params
    } catch (e) {
      // make this an event
      sendHttpError(client, BasedErrorCode.InvalidPayload)
    }
  } else if (
    contentType.startsWith('text') ||
    contentType === 'application/xml'
  ) {
    return data.toString()
  } else {
    if (rawBuffer) {
      return Buffer.alloc(data.byteLength, data)
    }
    return data
  }
}

export const readBody = (
  server: BasedServer,
  client: HttpClient,
  onData: (data: any | void) => void,
  maxSize: number
) => {
  if (!client.res) {
    return
  }

  const contentLen = client.context.headers['content-length']

  if (contentLen > maxSize) {
    sendHttpError(server, client, BasedErrorCode.PayloadTooLarge)
    return
  }

  const contentType = client.context.headers['content-type']
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
        if (size > maxSize) {
          sendHttpError(server, client, BasedErrorCode.PayloadTooLarge)
          // sendHttpError(client, 'Payload Too Large', 413)
          uncompressStream.destroy()
          return
        }
        if (c.byteLength > MAX_CHUNK_SIZE) {
          sendHttpError(server, client, BasedErrorCode.ChunkTooLarge)

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
      let data: Buffer
      uncompressStream.on('data', (c) => {
        if (!data) {
          data = c
        } else {
          data = Buffer.concat([data, c])
        }
      })
      uncompressStream.on('end', () => {
        uncompressStream.destroy()
        onData(parseData(server, client, contentType, data, false))
      })
    } else {
      sendHttpError(
        server,
        client,
        BasedErrorCode.InvalidPayload,
        'Unsupported Content-Encoding'
      )
    }
  } else {
    let data: Buffer
    client.res.onData((c, isLast) => {
      size += c.byteLength
      if (size > maxSize) {
        sendHttpError(server, client, BasedErrorCode.PayloadTooLarge)
        return
      }
      if (c.byteLength > MAX_CHUNK_SIZE) {
        sendHttpError(server, client, BasedErrorCode.ChunkTooLarge)
        return
      }
      if (!data && isLast) {
        data = Buffer.from(c)
        onData(parseData(server, client, contentType, data, true))
        return
      } else if (!data) {
        data = Buffer.alloc(c.byteLength, Buffer.from(c))
      } else {
        data = Buffer.concat([data, Buffer.from(c)])
      }
      if (isLast) {
        onData(parseData(server, client, contentType, data, false))
      }
    })
  }
}
