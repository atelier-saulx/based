export enum BasedErrorCode {
  FunctionError = 50001,
  AuthorizeFunctionError = 50002,
  NoOservableCacheAvailable = 50003,
  ObservableFunctionError = 50004,
  ObserveCallbackError = 50005,
  FunctionNotFound = 40401,
  FunctionIsNotObservable = 40402,
  FunctionIsObservable = 40403,
  FunctionIsStream = 40404,
  CannotStreamToObservableFunction = 40402,
  AuthorizeRejectedError = 40301,
  InvalidPayload = 40001,
  PayloadTooLarge = 40002,
  ChunkTooLarge = 40003,
  UnsupportedContentEncoding = 40004,
  NoBinaryProtocol = 40005,
  LengthRequired = 41101,
  MethodNotAllowed = 40501,
}

export type BasedErrorData = {
  message: string
  stack: string
  requestId?: number
  observableId?: number
  code: BasedErrorCode
  statusCode?: number
}

export class BasedError extends Error {
  public statusMessage?: string
  public code: BasedErrorCode
}

export const convertDataToBasedError = (
  payload: BasedErrorData,
  stack?: string
): BasedError => {
  const { message, /* requestId, */ code } = payload
  const msg =
    message[0] === '[' ? message : `[${BasedErrorCode[code]}] ` + message
  const error = new BasedError(msg)
  error.stack = stack ? msg + ' ' + stack : msg
  error.name = BasedErrorCode[code]
  error.code = code
  return error
}