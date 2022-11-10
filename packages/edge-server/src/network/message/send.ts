import { valueToBuffer, encodeErrorResponse } from '../../protocol'
import { BasedErrorCode, ErrorPayload, createError } from '../../error'
import { WebsocketClient } from '../../types'
import { BasedServer } from '../../server'

export function sendError<T extends BasedErrorCode>(
  server: BasedServer,
  client: WebsocketClient,
  basedCode: T,
  err?: ErrorPayload[T]
): void {
  const errorData = createError(server, client, basedCode, err)
  client.ws?.send(encodeErrorResponse(valueToBuffer(errorData)), true, false)
}
