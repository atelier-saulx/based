import { HttpClient } from '../../types'
import zlib from 'node:zlib'
import { sendError } from './sendError'

export const readBody = (
  client: HttpClient,
  onData: (data: any | void) => void,
  contentEncoding: string,
  maxSize: number
) => {
  let data = Buffer.from([])

  const readData = (chunk: Buffer, isLast: boolean) => {
    data = Buffer.concat([data, chunk])
    if (data.length > maxSize) {
      sendError(client, 'Payload Too Large', 413)
      return
    }

    console.info('reading data from', data.length, maxSize)

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
          sendError(client, 'Invalid Payload', 400)
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
    let uncompressStream: zlib.Deflate | zlib.Gunzip
    if (contentEncoding === 'deflate') {
      uncompressStream = zlib.createInflate()
    }
    if (uncompressStream) {
      let last = false
      client.res.onData((c, isLast) => {
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
      sendError(client, 'Unsupported Content-Encoding', 400)
    }
  } else {
    client.res.onData((c, isLast) => readData(Buffer.from(c), isLast))
  }
}
