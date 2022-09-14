import { HttpClient } from '../../types'
import end from './end'

const MAX_BODY_SIZE = 4 ** 20 // 2MB

export default (
  client: HttpClient,
  contentType: string,
  // add more later...
  onData: (data: any | void) => void
) => {
  let data = Buffer.from([])
  client.res.onData(async (chunk, isLast) => {
    if (!client.res) {
      return
    }
    data = Buffer.concat([data, Buffer.from(chunk)])
    if (data.length > MAX_BODY_SIZE) {
      client.res.writeStatus('413 Payload Too Large')
      client.res.writeHeader('Access-Control-Allow-Origin', '*')
      client.res.writeHeader('Access-Control-Allow-Headers', 'content-type')
      end(client, `{"code":413,"error":"Payload Too Large"}`)
      return
    }
    if (isLast) {
      let params
      const str = data.toString()
      // also check for buffer / binary daya
      // may want to do this differently....
      if (contentType === 'application/json' || !contentType) {
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
      } else {
        onData(str)
      }
    }
  })
}
