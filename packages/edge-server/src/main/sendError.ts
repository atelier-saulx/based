import uws from '@based/uws'
import { end } from '../main/sendHttpResponse'
import { BasedServer } from '../main/server'
import { HttpClient, WebsocketClient, isHttpClient } from '../types'
import { valueToBuffer, encodeErrorResponse } from '../protocol'
import {
  BasedErrorCode,
  ErrorPayload,
  BasedErrorData,
  createError,
} from '../error'

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
  payload: ErrorPayload[T]
) {
  if (!client.res) {
    return
  }
  client.res.cork(() => {
    end(
      client,
      sendHttpErrorMessage(
        client.res,
        createError(server, client, basedCode, payload)
      )
    )
  })
}

export function sendError<T extends BasedErrorCode>(
  server: BasedServer,
  client: WebsocketClient | HttpClient,
  basedCode: T,
  payload: ErrorPayload[T]
): void {
  if (isHttpClient(client)) {
    return sendHttpError(server, client, basedCode, payload)
  }
  const errorData = createError(server, client, basedCode, payload)
  client.ws?.send(encodeErrorResponse(valueToBuffer(errorData)), true, false)
}
