import {
  HttpSession,
  Context,
  BasedDataStream,
  BasedRoute,
} from '@based/functions'
import { sendError } from '../../../../sendError.js'
import zlib from 'node:zlib'
import { BasedErrorCode } from '@based/errors'
import { BasedServer } from '../../../../server.js'

const MAX_CHUNK_SIZE = 1024 * 1024 * 5

const UNCOMPRESS_OPTS = {
  chunkSize: 1024 * 1024 * 5,
}

export default (
  server: BasedServer,
  route: BasedRoute<'stream'>,
  ctx: Context<HttpSession>,
  size: number
): BasedDataStream => {
  const stream = new BasedDataStream(size)
  const contentEncoding = ctx.session.headers['content-encoding']

  if (contentEncoding) {
    let uncompressStream: zlib.Deflate | zlib.Gunzip | zlib.BrotliDecompress
    if (contentEncoding === 'deflate') {
      uncompressStream = zlib.createInflate(UNCOMPRESS_OPTS)
    } else if (contentEncoding === 'gzip') {
      uncompressStream = zlib.createGunzip(UNCOMPRESS_OPTS)
    } else if (contentEncoding === 'br') {
      uncompressStream = zlib.createBrotliDecompress(UNCOMPRESS_OPTS)
    }
    if (uncompressStream) {
      ctx.session.res.onData((c, isLast) => {
        if (c.byteLength > MAX_CHUNK_SIZE) {
          sendError(server, ctx, BasedErrorCode.ChunkTooLarge, route)
          uncompressStream.destroy()
          stream.destroy()
          return
        }
        const buf = Buffer.alloc(c.byteLength, Buffer.from(c))
        if (isLast) {
          uncompressStream.end(buf)
        } else {
          if (!uncompressStream.write(buf)) {
            // do stuff
          }
        }
      })
      uncompressStream.on('error', (err) => {
        console.warn('Uncompress error', route, contentEncoding, err)
        sendError(server, ctx, BasedErrorCode.ChunkTooLarge, route)
        uncompressStream.destroy()
        stream.destroy()
      })
      uncompressStream.pipe(stream)
    } else {
      sendError(server, ctx, BasedErrorCode.UnsupportedContentEncoding, route)
    }
  } else {
    ctx.session.res.onData((c, isLast) => {
      if (c.byteLength > MAX_CHUNK_SIZE) {
        sendError(server, ctx, BasedErrorCode.ChunkTooLarge, route)
        stream.destroy()
        return
      }
      if (isLast) {
        stream.end(Buffer.from(c))
      } else {
        stream.write(Buffer.from(c))
      }
    })
  }

  return stream
}
