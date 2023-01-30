import { BasedRoute } from '../functions'

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
  CannotStreamToObservableFunction = 40405,
  FunctionIsNotStream = 40406,
  AuthorizeRejectedError = 40301,
  InvalidPayload = 40001,
  PayloadTooLarge = 40002,
  ChunkTooLarge = 40003,
  UnsupportedContentEncoding = 40004,
  NoBinaryProtocol = 40005,
  LengthRequired = 41101,
  MethodNotAllowed = 40501,
  RateLimit = 40029,
  MissingAuthStateProtocolHeader = 40030,
}

type FunctionErrorProps = {
  err: Error | string
  requestId?: number
  route: BasedRoute
}

type ObservableFunctionErrorProps = {
  observableId: number
  err: Error | string
  route: BasedRoute
}

type FunctionBasicPayload = {
  route: BasedRoute
  requestId?: number
}

type BasedErrorPayload =
  | {
      observableId: number
      route: BasedRoute
    }
  | {
      requestId: number
      route: BasedRoute
    }
  | { route: BasedRoute }

export type ErrorPayload = {
  [BasedErrorCode.RateLimit]: {}
  [BasedErrorCode.MissingAuthStateProtocolHeader]: {}
  [BasedErrorCode.NoBinaryProtocol]: { buffer: ArrayBuffer }
  [BasedErrorCode.FunctionError]: FunctionErrorProps
  [BasedErrorCode.ObservableFunctionError]: ObservableFunctionErrorProps
  [BasedErrorCode.AuthorizeFunctionError]:
    | FunctionErrorProps
    | ObservableFunctionErrorProps
  [BasedErrorCode.AuthorizeRejectedError]: BasedErrorPayload
  [BasedErrorCode.ObserveCallbackError]: {
    err: Error
    observableId: number
    route: BasedRoute
  }
  [BasedErrorCode.NoOservableCacheAvailable]: {
    observableId: number
    route: BasedRoute
  }
  [BasedErrorCode.FunctionIsNotStream]: FunctionBasicPayload
  [BasedErrorCode.FunctionIsStream]: BasedErrorPayload
  [BasedErrorCode.FunctionNotFound]: BasedErrorPayload
  [BasedErrorCode.FunctionIsNotObservable]: {
    route: BasedRoute
    observableId?: number
  }
  [BasedErrorCode.FunctionIsObservable]: FunctionBasicPayload
  [BasedErrorCode.CannotStreamToObservableFunction]: FunctionBasicPayload
  [BasedErrorCode.InvalidPayload]: BasedErrorPayload
  [BasedErrorCode.PayloadTooLarge]: BasedErrorPayload
  [BasedErrorCode.ChunkTooLarge]: BasedRoute
  [BasedErrorCode.UnsupportedContentEncoding]: BasedRoute
  [BasedErrorCode.LengthRequired]: BasedRoute
  [BasedErrorCode.MethodNotAllowed]: BasedRoute
}

export type ErrorHandler<T extends BasedErrorCode> = {
  statusCode: number
  statusMessage: string
  message: (payload: ErrorPayload[T]) => string
}

export type BasedErrorData<T extends BasedErrorCode = BasedErrorCode> = {
  route: BasedRoute
  message: string
  code: T
  statusCode: number
  statusMessage: string
  requestId?: number
  observableId?: number
}
