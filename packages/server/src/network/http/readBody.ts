import { HttpClient } from '../../types'
import zlib from 'node:zlib'
import { sendHttpError } from './send'

export const readBody = (
  client: HttpClient,
  onData: (data: any | void) => void,
  maxSize: number
) => {
  if (!client.res) {
    return
  }

  const contentEncoding = client.context.contentEncoding
  let data = Buffer.from([])
  let size = 0

  const readData = (chunk: Buffer, isLast: boolean) => {
    data = Buffer.concat([data, chunk])
    if (isLast) {
      const contentType = client.context.contentType
      if (contentType === 'application/json' || !contentType) {
        const str = data.toString()
        let params
        try {
          params = data.length ? JSON.parse(str) : undefined
          onData(params)
        } catch (e) {
          console.error(e, str)
          sendHttpError(client, 'Invalid Payload', 400)
        }
      } else if (
        contentType.startsWith('text') ||
        contentType === 'application/xml'
      ) {
        onData(data.toString())
      } else {
        onData(data)
      }
    }
  }

  if (contentEncoding) {
    /*
    Content-Encoding: gzip
    Content-Encoding: deflate
    Content-Encoding: br
    */
    let uncompressStream: zlib.Deflate | zlib.Gunzip
    if (contentEncoding === 'deflate') {
      uncompressStream = zlib.createInflate()
    } else if (contentEncoding === 'gzip') {
      uncompressStream = zlib.createGunzip()
    } else if (contentEncoding === 'br') {
      uncompressStream = zlib.createBrotliDecompress()
    }

    if (uncompressStream) {
      let last = false
      client.res.onData((c, isLast) => {
        size += c.byteLength
        if (size > maxSize) {
          sendHttpError(client, 'Payload Too Large', 413)
          uncompressStream.destroy()
          return
        }
        const buf = Buffer.from(c)
        last = isLast
        if (isLast) {
          uncompressStream.end(buf)
        } else {
          uncompressStream.push(buf)
        }
      })
      uncompressStream.on('data', (d) => {
        readData(d, last)
      })
    } else {
      sendHttpError(client, 'Unsupported Content-Encoding', 400)
    }
  } else {
    client.res.onData((c, isLast) => {
      size += c.byteLength
      if (size > maxSize) {
        sendHttpError(client, 'Payload Too Large', 413)
        return
      }
      readData(Buffer.from(c), isLast)
    })
  }
}
