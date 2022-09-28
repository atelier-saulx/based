import uws from '@based/uws'
// import nodeStream from './stream'
import { HttpClient } from '../../../../types'
import end from '../../end'

export const invalidReqNoCors = (res: uws.HttpResponse) => {
  res.aborted = true
  res
    .writeStatus('400 Invalid Request')
    .end(`{"code":400,"error":"Invalid Request"}`)
}

export type StreamOptions = {
  type: string
  size: number
}

const MAX_BODY_SIZE = 4 ** 20 // 2MB

export const readStream = (
  client: HttpClient,
  onData: (data: any | void) => void,
  maxSize = MAX_BODY_SIZE // 2MB
) => {
  let data = Buffer.from([])

  client.res.onData(async (chunk, isLast) => {
    if (!client.res) {
      return
    }

    // STREAM

    // Content type json OR nothing handle total
    // Size add the stream
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
      // dont do string just add handlers
      // also check for buffer / binary daya
      // may want to do this differently....
      if (
        client.context.contentType === 'application/json' ||
        !client.context.contentType
      ) {
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
