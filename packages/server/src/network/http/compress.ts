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
  payload: string | Buffer,
  encoding: string
): Promise<Buffer | string> => {
  if (!client.res) {
    return
  }
  if (encoding) {
    let compressed: Buffer
    if (!(payload instanceof Buffer)) {
      payload = Buffer.from(payload)
    }
    if (encoding.includes('deflate')) {
      client.res.writeHeader('Content-Encoding', 'deflate')
      compressed = await deflate(payload)
    } else if (encoding.includes('gzip')) {
      client.res.writeHeader('Content-Encoding', 'gzip')
      compressed = await gzip(payload)
    } else if (encoding.includes('br')) {
      client.res.writeHeader('Content-Encoding', 'br')
      compressed = await br(payload)
    }
    if (compressed) {
      return compressed
    }
  }
  return payload
}
