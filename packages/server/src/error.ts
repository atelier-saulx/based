import uws from '@based/uws'
import { valueToBuffer, encodeErrorResponse } from './protocol'

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
  ws: uws.WebSocket,
  error: Error | string,
  props: Partial<BasedErrorData> & { basedCode: BasedErrorCode }
): void => {
  const errorData = { message: null, stack: null, basedCode: null }
  if (typeof error === 'string') {
    errorData.message = error
    let captureTarget = { stack: null }
    Error.captureStackTrace(captureTarget, sendError)
    errorData.stack = captureTarget.stack
  } else {
    Object.getOwnPropertyNames(error).forEach((key: string) => {
      errorData[key] = error[key]
    })
  }

  ws.send(
    encodeErrorResponse(valueToBuffer({ ...errorData, ...props })),
    true,
    false
  )
}
