import { HttpClient } from '../../types'
import end from './end'

export const sendError = (
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
