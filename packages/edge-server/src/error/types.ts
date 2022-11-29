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
  RateLimit = 40029,
  // WorkerDied
}

export type BasedError<T extends BasedErrorCode = BasedErrorCode> = Error & {
  code: T
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
  [BasedErrorCode.RateLimit]: void
  [BasedErrorCode.NoBinaryProtocol]: { buffer: ArrayBuffer }
  [BasedErrorCode.FunctionError]: FunctionErrorProps
  [BasedErrorCode.ObservableFunctionError]: ObservableFunctionErrorProps
  [BasedErrorCode.AuthorizeFunctionError]:
    | FunctionErrorProps
    | ObservableFunctionErrorProps
  [BasedErrorCode.AuthorizeRejectedError]:
    | {
        observableId: number
        route: BasedFunctionRoute
      }
    | {
        requestId?: number
        route: BasedFunctionRoute
      }
  [BasedErrorCode.ObserveCallbackError]: {
    err: Error
    observableId: number
    route?: BasedFunctionRoute
  }
  [BasedErrorCode.NoOservableCacheAvailable]: {
    observableId: number
    route: BasedFunctionRoute
  }
  [BasedErrorCode.FunctionIsStream]: BasedFunctionRoute & { requestId?: number }
  [BasedErrorCode.FunctionNotFound]: BasedFunctionRoute & { requestId?: number }
  [BasedErrorCode.FunctionIsNotObservable]: BasedFunctionRoute & {
    requestId?: number
  }
  [BasedErrorCode.FunctionIsObservable]: BasedFunctionRoute & {
    requestId?: number
  }
  [BasedErrorCode.CannotStreamToObservableFunction]: BasedFunctionRoute & {
    requestId?: number
  }

  [BasedErrorCode.InvalidPayload]: BasedFunctionRoute & { requestId?: number }
  [BasedErrorCode.PayloadTooLarge]: BasedFunctionRoute & { requestId?: number }
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

export type BasedErrorData<T extends BasedErrorCode = BasedErrorCode> = {
  route: BasedFunctionRoute
  message: string
  code: T
  statusCode: number
  statusMessage: string
  requestId?: number
  observableId?: number
  err?: BasedError<T>
}
