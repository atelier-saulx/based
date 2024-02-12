import { BasedRoute } from '@based/functions'

export const EMPTY_ROUTE: BasedRoute = {
  name: 'no-route',
  path: '',
  type: 'function',
}

export enum BasedErrorCode {
  FunctionError = 50001,
  AuthorizeFunctionError = 50002,
  NoOservableCacheAvailable = 50003,
  ObserveCallbackError = 50005,
  FunctionNotFound = 40401,
  FunctionIsWrongType = 40402,
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
  IncorrectAccessKey = 40031,
  Block = 90001,
}

type FunctionErrorProps = {
  err: Error | string
  requestId?: number
  streamRequestId?: number
  route: BasedRoute
}

type ObservableFunctionErrorProps = {
  observableId: number
  err: Error | string
  route: BasedRoute
}

type ChannelFunctionErrorProps = {
  channelId: number
  err: Error | string
  route: BasedRoute
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
  | {
      channelId: number
      route: BasedRoute
    }
  | { route: BasedRoute }

type BasedFunctionError =
  | FunctionErrorProps
  | ObservableFunctionErrorProps
  | ChannelFunctionErrorProps

export type ErrorPayload = {
  [BasedErrorCode.FunctionNotFound]: BasedErrorPayload
  [BasedErrorCode.RateLimit]: {}
  [BasedErrorCode.Block]: {}
  [BasedErrorCode.IncorrectAccessKey]: {}
  [BasedErrorCode.MissingAuthStateProtocolHeader]: {}
  [BasedErrorCode.NoBinaryProtocol]: { buffer: ArrayBuffer }
  [BasedErrorCode.FunctionError]: BasedFunctionError
  [BasedErrorCode.AuthorizeFunctionError]: BasedFunctionError
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
  [BasedErrorCode.FunctionIsWrongType]: BasedErrorPayload
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
  streamRequestId?: number
  observableId?: number
  channelId?: number
}
