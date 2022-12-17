import { HttpSession, Context } from '../../client'
import zlib from 'node:zlib'
import { BasedFunctionRoute } from '../../functions'
import { BasedErrorCode } from '../../error'
import { BasedServer } from '../../server'
import { sendError } from '../../sendError'

// TODO: might be good to use worker stream as well for this

const MAX_CHUNK_SIZE = 1024 * 1024

const UNCOMPRESS_OPTS = {
  // can be endless scince we limit by incoming
  chunkSize: 1024 * 1024 * 1000,
}

export const readBody = (
  server: BasedServer,
  ctx: Context<HttpSession>,
  onData: (data: any | void) => void,
  route: BasedFunctionRoute
) => {
  if (!ctx.session) {
    return
  }

  const contentLen = ctx.session.headers['content-length']

  if (contentLen > route.maxPayloadSize) {
    sendError(server, ctx, BasedErrorCode.PayloadTooLarge, route)
    return
  }

  const contentEncoding = ctx.session.headers['content-encoding']
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
      ctx.session.res.onData((c, isLast) => {
        size += c.byteLength
        if (size > route.maxPayloadSize) {
          sendError(server, ctx, BasedErrorCode.PayloadTooLarge, route)
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
        onData(buf)
      })
    } else {
      sendError(server, ctx, BasedErrorCode.InvalidPayload, route)
    }
  } else {
    const buf = new Uint8Array(contentLen)
    let index = 0
    ctx.session.res.onData((c, isLast) => {
      const len = c.byteLength

      size += len
      if (size > route.maxPayloadSize) {
        sendError(server, ctx, BasedErrorCode.PayloadTooLarge, route)
        return
      }
      if (c.byteLength > MAX_CHUNK_SIZE) {
        sendError(server, ctx, BasedErrorCode.ChunkTooLarge, route)
        return
      }

      buf.set(new Uint8Array(c), index)
      index += len

      if (isLast) {
        onData(buf)
      }
    })
  }
}
