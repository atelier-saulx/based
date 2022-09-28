import { HttpClient } from '../../types'
import end from './end'

export const readBody = (
  client: HttpClient,
  onData: (data: any | void) => void,
  encoding: string,
  maxSize: number
) => {
  let data = Buffer.from([])
  client.res.onData(async (chunk, isLast) => {
    if (!client.res) {
      return
    }

    /*
    Content-Encoding: gzip
    Content-Encoding: compress
    Content-Encoding: deflate
    Content-Encoding: br
    // Multiple, in the order in which they were applied
    Content-Encoding: deflate, gzip
    */

    // if encoding lets defalte!

    data = Buffer.concat([data, Buffer.from(chunk)])
    if (data.length > maxSize) {
      client.res.writeStatus('413 Payload Too Large')
      client.res.writeHeader('Access-Control-Allow-Origin', '*')
      client.res.writeHeader('Access-Control-Allow-Headers', 'content-type')
      end(client, `{"code":413,"error":"Payload Too Large"}`)
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
          client.res.writeStatus('400 Invalid Request')
          client.res.writeHeader('Access-Control-Allow-Origin', '*')
          client.res.writeHeader('Access-Control-Allow-Headers', 'content-type')
          end(client, `{"code":400,"error":"Invalid payload"}`)
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
  })
}
