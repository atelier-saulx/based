import { DataStream } from './DataStream'
import { HttpClient } from '../../../types'
import { sendHttpError } from '../send'
import zlib from 'node:zlib'
import { BasedErrorCode } from '../../../error'

const MAX_CHUNK_SIZE = 1024 * 1024 * 5

const UNCOMPRESS_OPTS = {
  // can be endless scince we limit by incoming
  chunkSize: 1024 * 1024 * 100,
}

export default (client: HttpClient, size: number): DataStream => {
  const stream = new DataStream()
  let total = 0
  let progress = 0
  let setInProgress = false
  stream.emit('progress', progress)
  const emitProgress = size > 200000

  const contentEncoding = client.context.headers['content-encoding']

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
        total += c.byteLength
        if (c.byteLength > MAX_CHUNK_SIZE) {
          sendHttpError(client, BasedErrorCode.ChunkTooLarge)
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
            // handle backpressure
          }
        }
      })
      uncompressStream.pipe(stream)
    } else {
      sendHttpError(
        client,
        BasedErrorCode.InvalidPayload,
        'Unsupported Content-Encoding'
      )
    }
  } else {
    client.res.onData((c, isLast) => {
      total += c.byteLength
      if (c.byteLength > MAX_CHUNK_SIZE) {
        sendHttpError(client, BasedErrorCode.ChunkTooLarge)
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
