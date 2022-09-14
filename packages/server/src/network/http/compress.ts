import zlib from 'node:zlib'
import { promisify } from 'node:util'

const deflate = promisify(zlib.deflate)
const gzip = promisify(zlib.gzip)
const br = promisify(zlib.brotliCompress)

export const compress = async (
  payload: string | Buffer,
  encoding: string
): Promise<Buffer | string> => {
  if (encoding) {
    let compressed: Buffer
    if (!(payload instanceof Buffer)) {
      payload = Buffer.from(payload)
    }
    if (encoding.includes('deflate')) {
      compressed = await deflate(payload)
    } else if (encoding.includes('gzip')) {
      compressed = await gzip(payload)
    } else if (encoding.includes('br')) {
      compressed = await br(payload)
    }
    if (compressed) {
      return compressed
    }
  }
  return payload
}
