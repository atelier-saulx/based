import { DataStream } from './DataStream'
import { HttpClient } from '../../../types'
import { sendHttpError } from '../send'
import zlib from 'node:zlib'

export default (client: HttpClient, size: number): DataStream => {
  const stream = new DataStream()
  let total = 0
  let progress = 0
  let setInProgress = false
  stream.emit('progress', progress)

  const readData =
    size > 200000
      ? (buf: Buffer, isLast: boolean) => {
          progress = total / size
          if (!setInProgress) {
            setInProgress = true
            setTimeout(() => {
              stream.emit('progress', progress)
              setInProgress = false
            }, 250)
          }
          if (isLast) {
            stream.end(buf)
          } else {
            stream.write(buf)
          }
        }
      : (buf: Buffer, isLast: boolean) => {
          if (isLast) {
            stream.end(buf)
            stream.emit('progress', 1)
          } else {
            stream.write(buf)
          }
        }

  const contentEncoding = client.context.headers['content-encoding']
  if (contentEncoding) {
    /*
    Content-Encoding: gzip
    Content-Encoding: deflate
    Content-Encoding: br
    */
    let uncompressStream: zlib.Deflate | zlib.Gunzip | zlib.BrotliDecompress
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
        total += c.byteLength

        console.log('???', total)

        // if (total > size) {
        //   sendHttpError(client, 'Payload Too Large', 413)
        //   uncompressStream.destroy()
        //   return
        // }
        const buf = Buffer.from(c)
        last = isLast
        if (isLast) {
          uncompressStream.end(buf)
        } else {
          uncompressStream.push(buf)
        }
      })
      uncompressStream.on('data', (d) => {
        // readData(d, last)
      })
    } else {
      sendHttpError(client, 'Unsupported Content-Encoding', 400)
    }
  } else {
    client.res.onData((c, isLast) => {
      total += c.byteLength
      if (total > size) {
        sendHttpError(client, 'Payload Too Large', 413)
        return
      }
      readData(Buffer.from(c), isLast)
    })
  }

  return stream
}
