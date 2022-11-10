import { BasedFunctionRoute } from '../types'

export const EMPTY_ROUTE = {
  name: 'no-route',
  path: '',
}

export enum BasedErrorCode {
  FunctionError = 50001,
  AuthorizeFunctionError = 50002,
  NoOservableCacheAvailable = 50003,
  ObservableFunctionError = 50004,
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
  // WorkerDied
}

type FunctionErrorProps = {
  err: Error
  requestId?: number
  route: BasedFunctionRoute
}

type ObservableFunctionErrorProps = {
  observableId: number
  err: Error
  route: BasedFunctionRoute
}

export type ErrorPayload = {
  [BasedErrorCode.NoBinaryProtocol]: BasedFunctionRoute
  [BasedErrorCode.FunctionError]: FunctionErrorProps
  [BasedErrorCode.ObservableFunctionError]: ObservableFunctionErrorProps
  [BasedErrorCode.AuthorizeFunctionError]:
    | FunctionErrorProps
    | ObservableFunctionErrorProps
  [BasedErrorCode.NoOservableCacheAvailable]: {
    observableId: number
    route: BasedFunctionRoute
  }
  [BasedErrorCode.FunctionIsStream]: BasedFunctionRoute
  [BasedErrorCode.FunctionNotFound]: BasedFunctionRoute
  [BasedErrorCode.FunctionIsNotObservable]: BasedFunctionRoute
  [BasedErrorCode.FunctionIsObservable]: BasedFunctionRoute
  [BasedErrorCode.CannotStreamToObservableFunction]: BasedFunctionRoute
  [BasedErrorCode.AuthorizeRejectedError]: BasedFunctionRoute
  [BasedErrorCode.InvalidPayload]: BasedFunctionRoute
  [BasedErrorCode.PayloadTooLarge]: BasedFunctionRoute
  [BasedErrorCode.ChunkTooLarge]: BasedFunctionRoute
  [BasedErrorCode.UnsupportedContentEncoding]: BasedFunctionRoute
  [BasedErrorCode.LengthRequired]: BasedFunctionRoute
  [BasedErrorCode.MethodNotAllowed]: BasedFunctionRoute
}

export type ErrorHandler<T extends BasedErrorCode> = {
  statusCode: number
  statusMessage: string
  message: (payload: ErrorPayload[T]) => string
}

export type BasedErrorData = {
  route: BasedFunctionRoute
  message: string
  code: BasedErrorCode
  statusCode: number
  statusMessage: string
  requestId?: number
  observableId?: number
  err?: Error
}
