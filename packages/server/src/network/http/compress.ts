import zlib from 'node:zlib'
import { promisify } from 'node:util'
import { HttpClient } from '../../types'

const deflate = promisify(zlib.deflate)
const gzip = promisify(zlib.gzip)
const br = promisify(zlib.brotliCompress)

/*
Content-Encoding: gzip
Content-Encoding: compress
Content-Encoding: deflate
Content-Encoding: br
*/

export const compress = async (
  client: HttpClient,
  payload: string | Buffer
): Promise<{ payload: Buffer | string; encoding?: string }> => {
  if (!client.res) {
    return
  }

  const encoding = client.context.headers.encoding

  if (payload instanceof Buffer && payload.byteLength < 400) {
    return { payload }
  }

  // assume 4 bytes per char
  if (payload.length < 100) {
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
