import { valueToBuffer, encodeErrorResponse } from '../../protocol'
import { BasedErrorCode, ErrorPayload, createError } from '../../error'
import { WebsocketClient } from '../../types'
import { BasedServer } from '../../server'

export function sendError<T extends BasedErrorCode>(
  server: BasedServer,
  client: WebsocketClient,
  basedCode: T,
  payload: ErrorPayload[T]
): void {
  const errorData = createError(server, client, basedCode, payload)
  console.info('!!!! SEND ERROR TO CLIENT', errorData)
  client.ws?.send(encodeErrorResponse(valueToBuffer(errorData)), true, false)
}
