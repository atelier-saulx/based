import uws from '@based/uws'
// import nodeStream from './stream'
import { HttpClient } from '../../../types'
import end from '../end'
import { DataStream } from './DataStream'

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

// export default async (
//   server: BasedServer,
//   name: string,
//   req: uws.HttpRequest,
//   res: uws.HttpResponse
// ) => {
//   const method = req.getMethod()

//   if (method !== 'post') {
//     console.info('options or get')
//     res.end('')
//     return
//   }

//   const type = req.getHeader('content-type')

//   if (type === 'multipart/form-data') {
//     // formStream(server, res)
//     return
//   }

//   const size = Number(req.getHeader('content-length'))

//   if (!type) {
//     invalidReqNoCors(res)
//     return
//   }

//   const opts: StreamOptions = {
//     size,
//     type,
//   }

//   if (!opts.size) {
//     invalidReqNoCors(res)
//     return
//   }

//   stream(res, size)
// }

export const readStream = (
  allowStream: boolean,
  client: HttpClient,
  contentType: string,
  // add more later...
  onData: (data: any | void, stream?: DataStream) => void
) => {
  let data = Buffer.from([])

  // here we are handling stuff

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
