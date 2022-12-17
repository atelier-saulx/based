import { DataStream } from './DataStream'
import { HttpSession, Context } from '../../../client'
import { BasedFunctionRoute } from '../../../functions'
import { sendError } from '../../../sendError'
import zlib from 'node:zlib'
import { BasedErrorCode } from '../../../error'
import { BasedServer } from '../../../server'

const MAX_CHUNK_SIZE = 1024 * 1024 * 5

const UNCOMPRESS_OPTS = {
  chunkSize: 1024 * 1024 * 5,
}

export default (
  server: BasedServer,
  route: BasedFunctionRoute,
  ctx: Context<HttpSession>,
  size: number
): DataStream => {
  const stream = new DataStream()
  let total = 0
  let progress = 0
  let setInProgress = false
  stream.emit('progress', progress)
  const emitProgress = size > 200000

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
        total += c.byteLength
        if (c.byteLength > MAX_CHUNK_SIZE) {
          sendError(server, ctx, BasedErrorCode.ChunkTooLarge, route)
          uncompressStream.destroy()
          stream.destroy()
          return
        }

        const buf = Buffer.alloc(c.byteLength, Buffer.from(c))

        if (emitProgress) {
          progress = total / size
          if (!setInProgress) {
            setInProgress = true
            setTimeout(() => {
              stream.emit('progress', progress)
              setInProgress = false
            }, 250)
          }
        }

        if (isLast) {
          if (!emitProgress) {
            stream.emit('progress', 1)
          }
          uncompressStream.end(buf)
        } else {
          if (!uncompressStream.write(buf)) {
            // console.info('BACKPRESSURE')
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
      total += c.byteLength
      if (c.byteLength > MAX_CHUNK_SIZE) {
        sendError(server, ctx, BasedErrorCode.ChunkTooLarge, route)
        stream.destroy()
        return
      }
      if (emitProgress) {
        progress = total / size
        if (!setInProgress) {
          setInProgress = true
          setTimeout(() => {
            stream.emit('progress', progress)
            setInProgress = false
          }, 250)
        }
      }
      if (isLast) {
        if (!emitProgress) {
          stream.emit('progress', 1)
        }
        stream.end(Buffer.from(c))
      } else {
        stream.write(Buffer.from(c))
      }
    })
  }

  return stream
}
