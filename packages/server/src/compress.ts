import zlib from 'node:zlib'
import { promisify } from 'node:util'
import { COMPRESS_FROM_BYTES } from './protocol.js'

const deflate = promisify(zlib.deflate)
const gzip = promisify(zlib.gzip)
const br = promisify(zlib.brotliCompress)

/*
Content-Encoding: gzip
Content-Encoding: compress
Content-Encoding: deflate
Content-Encoding: br
*/

const COMPRESS_STRING_LEN = Math.ceil(COMPRESS_FROM_BYTES / 1.5)

export const compress = async (
  payload: string | Buffer,
  encoding?: string,
): Promise<{ payload: Buffer | string; encoding?: string }> => {
  if (payload instanceof Buffer && payload.byteLength <= COMPRESS_FROM_BYTES) {
    return { payload }
  }

  if (payload === undefined) {
    return
  }

  if (payload.length < COMPRESS_STRING_LEN) {
    return { payload }
  }

  if (encoding && typeof encoding === 'string') {
    let responseEncoding: string
    let compressed: Buffer
    if (!(payload instanceof Buffer)) {
      payload = Buffer.from(payload)
    }
    if (encoding.includes('deflate')) {
      responseEncoding = 'deflate'
      compressed = await deflate(payload)
    } else if (encoding.includes('gzip')) {
      responseEncoding = 'gzip'
      compressed = await gzip(payload)
    } else if (encoding.includes('br')) {
      responseEncoding = 'br'
      compressed = await br(payload)
    }
    if (compressed) {
      return { payload: compressed, encoding: responseEncoding }
    }
  }
  return { payload }
}
