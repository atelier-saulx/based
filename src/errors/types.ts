import type { BasedRoute } from '../functions/functions.js'

export enum BasedErrorCode {
  // Parse Errors
  incorrectFieldType = 1000,
  incorrectNodeType = 1001,
  exceedsMaximum = 1002,
  subceedsMinimum = 1003,
  fieldDoesNotExist = 1004,
  incorrectFormat = 1005,
  referenceIsIncorrectType = 1006,
  valueAndDefault = 1007,
  defaultNotSupported = 1008,
  multipleOperationsNotAllowed = 1009,
  requiredFieldNotDefined = 1010,
  languageNotSupported = 1011,
  invalidJSON = 1012,
  noLanguageFound = 1013,
  cannotDeleteNodeFromModify = 1014,
  nestedModifyObjectNotAllowed = 1015,
  infinityNotSupported = 1016,
  invalidSchemaFormat = 1017,
  invalidProperty = 1018,

  // client/server errors
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
  FunctionIsWrongType = 40406, // was 40402 in server
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

  // Mutation error
  PrefixAlreadyInUse = 2000,
  CannotChangeFieldInStrictMode = 2001,
  CannotRemoveFieldInStrictMode = 2002,
  CannotMutateWithExistingData = 2003,
  CannotDeleteRoot = 2004,
  CannotChangeDefaultField = 2005,
  CannotRemoveLastProperty = 2006,
}

export type BasedParseErrorPayload = {
  path: string[]
}

export type FunctionErrorProps = {
  err: Error | string
  requestId?: number
  streamRequestId?: number
  route: BasedRoute
}

export type ObservableFunctionErrorProps = {
  observableId: number
  err: Error | string
  route: BasedRoute
}

export type ChannelFunctionErrorProps = {
  channelId: number
  err: Error | string
  route: BasedRoute
}

export type BasedErrorPayload =
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
  | {
      streamRequestId: number
      route: BasedRoute
    }
  | { route: BasedRoute }

export type BasedFunctionError =
  | FunctionErrorProps
  | ObservableFunctionErrorProps
  | ChannelFunctionErrorProps

export type ErrorPayload = {
  [BasedErrorCode.incorrectFieldType]: BasedParseErrorPayload
  [BasedErrorCode.incorrectNodeType]: BasedParseErrorPayload
  [BasedErrorCode.exceedsMaximum]: BasedParseErrorPayload
  [BasedErrorCode.subceedsMinimum]: BasedParseErrorPayload
  [BasedErrorCode.fieldDoesNotExist]: BasedParseErrorPayload
  [BasedErrorCode.incorrectFormat]: BasedParseErrorPayload
  [BasedErrorCode.referenceIsIncorrectType]: BasedParseErrorPayload
  [BasedErrorCode.valueAndDefault]: BasedParseErrorPayload
  [BasedErrorCode.defaultNotSupported]: BasedParseErrorPayload
  [BasedErrorCode.multipleOperationsNotAllowed]: BasedParseErrorPayload
  [BasedErrorCode.requiredFieldNotDefined]: BasedParseErrorPayload
  [BasedErrorCode.languageNotSupported]: BasedParseErrorPayload
  [BasedErrorCode.invalidJSON]: BasedParseErrorPayload
  [BasedErrorCode.noLanguageFound]: BasedParseErrorPayload
  [BasedErrorCode.cannotDeleteNodeFromModify]: BasedParseErrorPayload
  [BasedErrorCode.nestedModifyObjectNotAllowed]: BasedParseErrorPayload
  [BasedErrorCode.infinityNotSupported]: BasedParseErrorPayload
  [BasedErrorCode.invalidSchemaFormat]: BasedParseErrorPayload
  [BasedErrorCode.invalidProperty]: BasedParseErrorPayload

  [BasedErrorCode.FunctionError]: BasedFunctionError
  [BasedErrorCode.AuthorizeFunctionError]: BasedFunctionError
  [BasedErrorCode.NoOservableCacheAvailable]: {
    observableId: number
    route: BasedRoute
  }
  [BasedErrorCode.ObservableFunctionError]: BasedFunctionError
  [BasedErrorCode.ObserveCallbackError]: {
    err: Error
    observableId: number
    route: BasedRoute
  }
  [BasedErrorCode.FunctionNotFound]: BasedErrorPayload
  [BasedErrorCode.FunctionIsNotObservable]: BasedErrorPayload // FunctionIsWrongType?
  [BasedErrorCode.FunctionIsObservable]: BasedErrorPayload // FunctionIsWrongType?
  [BasedErrorCode.FunctionIsStream]: BasedErrorPayload // FunctionIsWrongType?
  [BasedErrorCode.CannotStreamToObservableFunction]: BasedErrorPayload
  [BasedErrorCode.FunctionIsWrongType]: BasedErrorPayload
  [BasedErrorCode.AuthorizeRejectedError]: BasedErrorPayload
  [BasedErrorCode.InvalidPayload]: BasedErrorPayload
  [BasedErrorCode.PayloadTooLarge]: BasedErrorPayload
  [BasedErrorCode.ChunkTooLarge]: BasedRoute
  [BasedErrorCode.UnsupportedContentEncoding]: BasedRoute
  [BasedErrorCode.NoBinaryProtocol]: { buffer: ArrayBuffer }
  [BasedErrorCode.LengthRequired]: BasedRoute
  [BasedErrorCode.MethodNotAllowed]: BasedRoute
  [BasedErrorCode.RateLimit]: {}
  [BasedErrorCode.MissingAuthStateProtocolHeader]: {}
  [BasedErrorCode.IncorrectAccessKey]: {}
  [BasedErrorCode.Block]: {}

  [BasedErrorCode.PrefixAlreadyInUse]: BasedParseErrorPayload
  [BasedErrorCode.CannotChangeFieldInStrictMode]: BasedParseErrorPayload
  [BasedErrorCode.CannotRemoveFieldInStrictMode]: BasedParseErrorPayload
  [BasedErrorCode.CannotMutateWithExistingData]: BasedParseErrorPayload
  [BasedErrorCode.CannotDeleteRoot]: BasedParseErrorPayload
  [BasedErrorCode.CannotChangeDefaultField]: BasedParseErrorPayload
  [BasedErrorCode.CannotRemoveLastProperty]: BasedParseErrorPayload
}

export type ErrorHandler<T extends BasedErrorCode> = {
  statusCode?: number
  statusMessage?: string
  message: (payload: ErrorPayload[T]) => string
}

export type BasedErrorData<T extends BasedErrorCode = BasedErrorCode> = {
  route?: BasedRoute
  message: string
  code: T
  statusCode?: number
  statusMessage?: string
  requestId?: number
  observableId?: number
  channelId?: number
  streamRequestId?: number
}
