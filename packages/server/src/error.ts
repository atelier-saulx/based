import { valueToBuffer, encodeErrorResponse } from './protocol'
import { WebsocketClient } from './types'

export enum BasedErrorCode {
  FunctionError = 50001,
  FunctionNotFound = 40401,
  AuthorizeError = 50002,
  AuthorizeRejectedError = 40301,
}
export type BasedErrorData = {
  message: string
  stack: string
  requestId?: number
  observableId?: number
  basedCode: BasedErrorCode
  code?: string
}

export const sendError = (
  client: WebsocketClient,
  error: Error | string,
  props: Partial<BasedErrorData> & { basedCode: BasedErrorCode }
): void => {
  const errorData = { message: null, stack: null, basedCode: null }
  if (typeof error === 'string') {
    errorData.message = error
    const captureTarget = { stack: null }
    Error.captureStackTrace(captureTarget, sendError)
    errorData.stack = captureTarget.stack
  } else {
    Object.getOwnPropertyNames(error).forEach((key: string) => {
      errorData[key] = error[key]
    })
  }

  client.ws?.send(
    encodeErrorResponse(valueToBuffer({ ...errorData, ...props })),
    true,
    false
  )
}
