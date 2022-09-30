import { HttpClient } from '../../types'
import uws from '@based/uws'
import end from './end'
import { compress } from './compress'

export const sendHttpError = (
  client: HttpClient,
  error: any,
  code: number = 400,
  status: string = 'Bad Request'
) => {
  if (!client.res) {
    return
  }
  client.res.cork(() => {
    client.res.writeStatus(`${code} ${status}`)
    client.res.writeHeader('Access-Control-Allow-Origin', '*')
    client.res.writeHeader('Access-Control-Allow-Headers', 'content-type')
    client.res.writeHeader('Content-Type', 'application/json')
    end(client, JSON.stringify({ error, code }))
  })
}

export const sendErrorRaw = (
  res: uws.HttpResponse,
  error: any,
  code: number = 400,
  status: string = 'Bad Request'
) => {
  res.cork(() => {
    res.writeStatus(`${code} ${status}`)
    res.writeHeader('Access-Control-Allow-Origin', '*')
    res.writeHeader('Access-Control-Allow-Headers', 'content-type')
    res.writeHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error, code }))
  })
}

export const sendHttpResponse = (client: HttpClient, result: any) => {
  if (!client.res) {
    return
  }

  const encoding = client.context.encoding

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
  compress(client, parsed, encoding).then((p) => {
    if (client.res) {
      client.res.cork(() => {
        client.res.writeStatus('200 OK')
        client.res.writeHeader('Cache-Control', 'max-age=0, must-revalidate')
        client.res.writeHeader('Content-Type', cType)
        end(client, p)
      })
    }
  })
}
