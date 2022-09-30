import { valueToBuffer, encodeErrorResponse } from '../../protocol'
import { BasedErrorCode, CreateErrorProps, createError } from '../../error'
import { WebsocketClient } from '../../types'

export const sendError = (
  client: WebsocketClient,
  basedCode: BasedErrorCode,
  err?: CreateErrorProps,
  overrides?: any
): void => {
  const errorData = createError(basedCode, err)
  client.ws?.send(
    encodeErrorResponse(valueToBuffer({ ...errorData, ...overrides })),
    true,
    false
  )
}
