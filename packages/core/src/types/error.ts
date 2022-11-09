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
  NoBinaryProtocol = 40005,
  LengthRequired = 41101,
  MethodNotAllowed = 40501,
}

export type BasedErrorData = {
  message: string
  stack: string
  requestId?: number
  observableId?: number
  basedCode: BasedErrorCode
  statusCode?: number
}

// TODO: Bellow functions should go to the fluffy client
export class BasedError extends Error {
  public statusCode?: number
  public statusMessage?: string
  public code?: BasedErrorCode

  // constructor(message: string) {
  //   super(message)
  // }
}

export const convertDataToBasedError = (
  payload: BasedErrorData,
  stack?: string
): BasedError => {
  const { message, /* requestId, */ ...otherProps } = payload
  const msg = 'Based ' + message
  const error = new BasedError()
  error.stack = stack ? msg + ' ' + stack : msg
  Object.keys(otherProps).forEach((key) => {
    error[key] = otherProps[key]
  })
  return error
}
