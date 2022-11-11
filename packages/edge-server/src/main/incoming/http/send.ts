import { HttpClient } from '../../../types'
import uws from '@based/uws'
import end from './end'
import { compress } from './compress'
import {
  BasedErrorCode,
  createError,
  ErrorPayload,
  BasedErrorData,
} from '../../error'
import { BasedServer } from '../../server'

const sendHttpErrorMessage = (
  res: uws.HttpResponse,
  error: BasedErrorData
): string => {
  const { code, message, statusCode, statusMessage } = error
  res.writeStatus(`${statusCode} ${statusMessage}`)
  res.writeHeader('Access-Control-Allow-Origin', '*')
  res.writeHeader('Access-Control-Allow-Headers', 'content-type')
  res.writeHeader('Content-Type', 'application/json')
  return JSON.stringify({
    error: message,
    code,
  })
}

export function sendHttpError<T extends BasedErrorCode>(
  server: BasedServer,
  client: HttpClient,
  basedCode: T,
  err: ErrorPayload[T]
) {
  if (!client.res) {
    return
  }
  client.res.cork(() => {
    end(
      client,
      sendHttpErrorMessage(
        client.res,
        createError(server, client, basedCode, err)
      )
    )
  })
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
