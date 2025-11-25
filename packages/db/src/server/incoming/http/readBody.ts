import zlib from 'node:zlib'
import { BasedServer } from '../../server.js'
import { sendError } from '../../sendError.js'
import querystring from 'node:querystring'
import type {
  BasedRoute,
  Context,
  HttpSession,
} from '../../../functions/index.js'
import { BasedErrorCode } from '../../../errors/types.js'

const decoder = new TextDecoder('utf-8')

const MAX_CHUNK_SIZE = 1024 * 1024

const UNCOMPRESS_OPTS = {
  // can be endless scince we limit by incoming
  chunkSize: 1024 * 1024 * 1000,
}

export const parseHttpPayload = (
  server: BasedServer,
  ctx: Context<HttpSession>,
  data: Uint8Array,
  route: BasedRoute,
): any => {
  const session = ctx.session!
  const contentType = session.headers['content-type']
  if (!contentType || contentType.startsWith('application/json')) {
    const str = decoder.decode(data)
    let parsedData: any
    try {
      if (data.byteLength) {
        parsedData = JSON.parse(str)
        session.rawBody = str
      }
      return parsedData
    } catch (err) {
      sendError(server, ctx, BasedErrorCode.InvalidPayload, { route })
    }
  } else if (
    contentType.startsWith('text') ||
    contentType === 'application/xml'
  ) {
    return decoder.decode(data)
  } else if (contentType === 'application/x-www-form-urlencoded') {
    const str = decoder.decode(data)
    try {
      const parsedData = { ...querystring.parse(str) }
      return parsedData
    } catch (error) {
      return str
    }
  } else {
    return data
  }
}

export const readBody = (
  server: BasedServer,
  ctx: Context<HttpSession>,
  onData: (data: any | void) => void,
  route: BasedRoute,
) => {
  const session = ctx.session
  if (!session) {
    return
  }

  const contentLen = session.headers['content-length']!

  if (contentLen > route.maxPayloadSize!) {
    sendError(server, ctx, BasedErrorCode.PayloadTooLarge, { route })
    return
  }

  const contentEncoding = session.headers['content-encoding']
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
    if (uncompressStream!) {
      session.res.onData((c, isLast) => {
        size += c.byteLength
        if (size > route.maxPayloadSize!) {
          sendError(server, ctx, BasedErrorCode.PayloadTooLarge, { route })
          uncompressStream.destroy()
          return
        }
        if (c.byteLength > MAX_CHUNK_SIZE) {
          sendError(server, ctx, BasedErrorCode.ChunkTooLarge, route)
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
        const buf = new Uint8Array(len)
        for (const c of chunks) {
          buf.set(c, i)
          i += c.byteLength
        }
        // readValue
        onData(parseHttpPayload(server, ctx, buf, route))
      })
    } else {
      sendError(server, ctx, BasedErrorCode.InvalidPayload, { route })
    }
  } else {
    const buf = new Uint8Array(contentLen)
    let index = 0
    session.res.onData((c, isLast) => {
      const len = c.byteLength

      size += len
      if (size > route.maxPayloadSize!) {
        sendError(server, ctx, BasedErrorCode.PayloadTooLarge, { route })
        return
      }
      if (c.byteLength > MAX_CHUNK_SIZE) {
        sendError(server, ctx, BasedErrorCode.ChunkTooLarge, route)
        return
      }

      buf.set(new Uint8Array(c), index)
      index += len

      if (isLast) {
        // readValue
        onData(parseHttpPayload(server, ctx, buf, route))
      }
    })
  }
}
