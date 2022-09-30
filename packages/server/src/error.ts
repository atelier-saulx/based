import { valueToBuffer, encodeErrorResponse } from './protocol'
import { WebsocketClient } from './types'

export enum BasedErrorCode {
  FunctionError = 50001,
  AuthorizeFunctionError = 50002,
  NoOservableCacheAvailable = 50003,
  ObservableFunctionError = 50004,
  FunctionNotFound = 40401,
  FunctionIsNotObservable = 40402,
  FunctionIsObservable = 40403,
  CannotStreamToObservableFunction = 40402,
  AuthorizeRejectedError = 40301,
  InvalidPayload = 40001,
  PayloadTooLarge = 40002,
  ChunkTooLarge = 40003,
  UnsupportedContentEncoding = 40004,
  LengthRequired = 41101,
  MethodNotAllowed = 40501,
}

enum StatusCode {
  Forbidden = 403,
  NotFound = 404,
  InternalServerError = 500,
}

export const defaultMessages = {
  [BasedErrorCode.FunctionError]: 'Error in function',
  [BasedErrorCode.FunctionNotFound]: 'Function not found',
  [BasedErrorCode.AuthorizeFunctionError]: 'Error in authorize function',
  [BasedErrorCode.AuthorizeRejectedError]: 'Authorize rejected',
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

// MAP OF ARGUMENTS TYPES

// GEN ERROR RETURNS AN OBJECT { status, message: (ARGS OF ERROR) => , code }
// SEND EVENT WITH ERROR

// ----------------------------------
// createError()

// ----------------------------------
// sendHtttpError / sendError

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
    errorData.message = defaultMessages[basedCode] || 'Ops something went wrong'
  }

  switch (basedCode) {
    case BasedErrorCode.FunctionError:
    case BasedErrorCode.AuthorizeFunctionError:
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
