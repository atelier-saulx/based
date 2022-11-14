import { HttpClient } from '../types'
import { compress } from './compress'

export const end = (
  client: HttpClient,
  payload?: string | Buffer | Uint8Array
) => {
  if (client.res) {
    client.res.writeHeader('Access-Control-Allow-Origin', '*')
    // only allowed headers
    client.res.writeHeader('Access-Control-Allow-Headers', '*')
    if (payload === undefined) {
      client.res.end()
    } else {
      client.res.end(payload)
    }
    client.res = null
    client.req = null
    client.context = null
  }
}

export const sendHttpResponse = (client: HttpClient, result: any) => {
  if (!client.res) {
    return
  }

  let cType: string

  // for functions there is never cache (idea is they are used to execute - observable fns are for cache)
  let parsed: string
  if (typeof result === 'string') {
    cType = 'text/plain'
    parsed = result
  } else {
    cType = 'application/json'
    parsed = JSON.stringify(result)
  }
  compress(client, parsed).then(({ payload, encoding }) => {
    if (client.res) {
      client.res.cork(() => {
        client.res.writeStatus('200 OK')
        client.res.writeHeader('Cache-Control', 'max-age=0, must-revalidate')
        client.res.writeHeader('Content-Type', cType)
        if (encoding) {
          client.res.writeHeader('Content-Encoding', encoding)
        }
        end(client, payload)
      })
    }
  })
}
