import { valueToBuffer, encodeErrorResponse } from './protocol'
import { WebsocketClient } from './types'

export enum BasedErrorCode {
  FunctionError = 50001,
  FunctionNotFound = 40401,
  AuthorizeError = 50002,
  AuthorizeRejectedError = 40301,
}

enum StatusCode {
  Forbidden = 403,
  NotFound = 404,
  InternalServerError = 500,
}

export type BasedErrorData = {
  message: string
  stack: string
  requestId?: number
  observableId?: number
  basedCode: BasedErrorCode
  statusCode?: StatusCode
  code?: string
}

export const sendError = (
  client: WebsocketClient,
  basedCode: BasedErrorCode,
  props: { observableId: number } | { requestId: number },
  error?: Error | string
): void => {
  const errorData: BasedErrorData = { message: null, stack: null, basedCode }
  if (typeof error === 'string') {
    errorData.message = error
    const captureTarget = { stack: null }
    Error.captureStackTrace(captureTarget, sendError)
    errorData.stack = captureTarget.stack
  } else if (error) {
    Object.getOwnPropertyNames(error).forEach((key: string) => {
      errorData[key] = error[key]
    })
  }

  if (typeof error === 'undefined' || error === null) {
    errorData.message =
      {
        [BasedErrorCode.FunctionError]: 'Error in function',
        [BasedErrorCode.FunctionNotFound]: 'Function not found',
        [BasedErrorCode.AuthorizeError]: 'Error in authorize function',
        [BasedErrorCode.AuthorizeRejectedError]: 'Authorize rejected',
      }[basedCode] || 'Ops something went wrong'
  }

  switch (basedCode) {
    case BasedErrorCode.FunctionError:
    case BasedErrorCode.AuthorizeError:
      errorData.statusCode = StatusCode.InternalServerError
      break
    case BasedErrorCode.FunctionNotFound:
      errorData.statusCode = StatusCode.NotFound
      break
    case BasedErrorCode.AuthorizeRejectedError:
      errorData.statusCode = StatusCode.Forbidden
      break
  }

  client.ws?.send(
    encodeErrorResponse(valueToBuffer({ ...errorData, ...props })),
    true,
    false
  )
}
