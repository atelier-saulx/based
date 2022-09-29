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
  client.res.writeStatus(`${code} ${status}`)
  client.res.writeHeader('Access-Control-Allow-Origin', '*')
  client.res.writeHeader('Access-Control-Allow-Headers', 'content-type')
  client.res.writeHeader('Content-Type', 'application/json')
  end(client, JSON.stringify({ error, code }))
}

export const sendErrorRaw = (
  res: uws.HttpResponse,
  error: any,
  code: number = 400,
  status: string = 'Bad Request'
) => {
  res.writeStatus(`${code} ${status}`)
  res.writeHeader('Access-Control-Allow-Origin', '*')
  res.writeHeader('Access-Control-Allow-Headers', 'content-type')
  res.writeHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ error, code }))
}

export const sendHttpResponse = (client: HttpClient, result: any) => {
  if (!client.res) {
    return
  }

  const encoding = client.context.encoding

  client.res.writeStatus('200 OK')
  // for functions there is never cache (idea is they are used to execute - observable fns are for cache)
  client.res.writeHeader('Cache-Control', 'max-age=0, must-revalidate')
  let parsed: string
  if (typeof result === 'string') {
    client.res.writeHeader('Content-Type', 'text/plain')
    parsed = result
  } else {
    client.res.writeHeader('Content-Type', 'application/json')
    parsed = JSON.stringify(result)
  }
  compress(client, parsed, encoding).then((p) => end(client, p))
}
