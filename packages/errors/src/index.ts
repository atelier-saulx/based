import { BasedRoute, isAnyBasedRoute } from '@based/functions'

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
  // PrefixAlreadyInUse = 2000,
}

type BasedParseErrorPayload = {
  path: string[]
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

type ChannelFunctionErrorProps = {
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
  | { route: BasedRoute }

type BasedFunctionError =
  | FunctionErrorProps
  | ObservableFunctionErrorProps
  | ChannelFunctionErrorProps

export type ErrorPayload = {
  [BasedErrorCode.incorrectFieldType]: BasedParseErrorPayload
  [BasedErrorCode.incorrectNodeType]: BasedParseErrorPayload
  [BasedErrorCode.exceedsMaximum]: BasedParseErrorPayload
  [BasedErrorCode.subceedsMinimum]: BasedParseErrorPayload
  [BasedErrorCode.fieldDoesNotExist]: BasedParseErrorPayload
  [BasedErrorCode.incorrectFormat]: BasedParseErrorPayload,
  [BasedErrorCode.referenceIsIncorrectType]: BasedParseErrorPayload,
  [BasedErrorCode.valueAndDefault]: BasedParseErrorPayload,
  [BasedErrorCode.defaultNotSupported]: BasedParseErrorPayload,
  [BasedErrorCode.multipleOperationsNotAllowed]: BasedParseErrorPayload,
  [BasedErrorCode.requiredFieldNotDefined]: BasedParseErrorPayload,
  [BasedErrorCode.languageNotSupported]: BasedParseErrorPayload,
  [BasedErrorCode.invalidJSON]: BasedParseErrorPayload,
  [BasedErrorCode.noLanguageFound]: BasedParseErrorPayload,
  [BasedErrorCode.cannotDeleteNodeFromModify]: BasedParseErrorPayload,
  [BasedErrorCode.nestedModifyObjectNotAllowed]: BasedParseErrorPayload,
  [BasedErrorCode.infinityNotSupported]: BasedParseErrorPayload,
  [BasedErrorCode.invalidSchemaFormat]: BasedParseErrorPayload,
  [BasedErrorCode.invalidProperty]: BasedParseErrorPayload,

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
}

const addName = (
  payload: { name: string } & { [key: string]: unknown }
): string => {
  return payload.name ? `[${payload.name}] ` : ''
}

type ErrorType = {
  [K in BasedErrorCode]: ErrorHandler<K>
}

export const errorTypeHandlers: ErrorType = {
  // Parse errors
  [BasedErrorCode.incorrectFieldType]: {
    message: (payload) => `[${payload.path.join('.')}] Incorrect field type.`
  },
  [BasedErrorCode.incorrectNodeType]: {
    message: (payload) => `[${payload.path.join('.')}] Incorrect node type.`
  },
  [BasedErrorCode.exceedsMaximum]: {
    message: (payload) => `[${payload.path.join('.')}] Exceeds maximum property.`
  },
  [BasedErrorCode.subceedsMinimum]: {
    message: (payload) => `[${payload.path.join('.')}] Subceeds minimum property.`
  },
  [BasedErrorCode.fieldDoesNotExist]: {
    message: (payload) => `[${payload.path.join('.')}] Field does not exist.`
  },
  [BasedErrorCode.incorrectFormat]: {
    message: (payload) => `[${payload.path.join('.')}] Incorrect format.`
  },
  [BasedErrorCode.referenceIsIncorrectType]: {
    message: (payload) => `[${payload.path.join('.')}] Reference is from incorrect type.`
  },
  [BasedErrorCode.valueAndDefault]: {
    message: (payload) => `[${payload.path.join('.')}] Value and $default are being used at the same time.`
  },
  [BasedErrorCode.defaultNotSupported]: {
    message: (payload) => `[${payload.path.join('.')}] $default is not suported.`
  },
  [BasedErrorCode.multipleOperationsNotAllowed]: {
    message: (payload) => `[${payload.path.join('.')}] Multiple operations are not allowed here.`
  },
  [BasedErrorCode.requiredFieldNotDefined]: {
    message: (payload) => `[${payload.path.join('.')}] Required field is not defined.`
  },
  [BasedErrorCode.languageNotSupported]: {
    message: (payload) => `[${payload.path.join('.')}] Language not supported.`
  },
  [BasedErrorCode.invalidJSON]: {
    message: (payload) => `[${payload.path.join('.')}] Invalid JSON.`
  },
  [BasedErrorCode.noLanguageFound]: {
    message: (payload) => `[${payload.path.join('.')}] No language found.`
  },
  [BasedErrorCode.cannotDeleteNodeFromModify]: {
    message: (payload) => `[${payload.path.join('.')}] Cannot delete node from modify.`
  },
  [BasedErrorCode.nestedModifyObjectNotAllowed]: {
    message: (payload) => `[${payload.path.join('.')}] Nested modify object not allowed.`
  },
  [BasedErrorCode.infinityNotSupported]: {
    message: (payload) => `[${payload.path.join('.')}] Infinity not supported.`
  },
  [BasedErrorCode.invalidSchemaFormat]: {
    message: (payload) => `[${payload.path.join('.')}] Invalid schema format.`
  },
  [BasedErrorCode.invalidProperty]: {
    message: (payload) => `[${payload.path.join('.')}] Invalid property.`
  },

  [BasedErrorCode.FunctionError]: {
    statusCode: 500,
    statusMessage: 'Internal Server Error',
    message: (payload) => {
      if (typeof payload.err === 'string' || !payload.err.message) {
        return `[${payload.route.name}] ${JSON.stringify(payload.err)}`
      }
      return (
        addName(payload.route) +
        `${payload.err.name && payload.err.name !== 'Error'
          ? `[${payload.err.name}] `
          : ''
        }${payload.err.message || ''}.`
      )
    },
  },
  [BasedErrorCode.AuthorizeFunctionError]: {
    statusCode: 403,
    statusMessage: 'Forbidden',
    message: (payload) => {
      if (typeof payload.err === 'string' || !payload.err.message) {
        return `[${payload.route.name}] ${JSON.stringify(payload.err)}`
      }
      return (
        addName(payload.route) +
        `${payload.err.name && payload.err.name !== 'Error'
          ? `[${payload.err.name}] `
          : ''
        }${payload.err.message || ''}.`
      )
    },
  },
  [BasedErrorCode.NoOservableCacheAvailable]: {
    statusCode: 500,
    statusMessage: 'Internal Server Error',
    message: (
      payload: ErrorPayload[BasedErrorCode.NoOservableCacheAvailable]
    ) =>
      addName(payload.route) +
      `No observable cache available${payload.route.name} - ${payload.observableId}.`,
  },
  [BasedErrorCode.ObservableFunctionError]: {
    statusCode: 500,
    statusMessage: 'Internal Server Error',
    message: (payload) => {
      if (typeof payload.err === 'string' || !payload.err.message) {
        return `[${payload.route.name} (observable)] ${JSON.stringify(payload.err)}.`
      }
      return (
        addName(payload.route) +
        `${payload.err.name && payload.err.name !== 'Error'
          ? `[${payload.err.name}] `
          : ''
        }${payload.err.message || ''}.`
      )
    },
  },
  [BasedErrorCode.ObserveCallbackError]: {
    statusCode: 500,
    statusMessage: 'Internal Server Error',
    message: () => {
      return 'Error in server side observer.'
    },
  },
  [BasedErrorCode.FunctionNotFound]: {
    statusCode: 404,
    statusMessage: 'Not Found',
    message: (payload) => {
      return (
        addName(payload.route) +
        `Function not found${payload.route.path ? ` path '${payload.route.path}'` : ''
        }.`
      )
    },
  },
  [BasedErrorCode.FunctionIsNotObservable]: {
    statusCode: 400,
    statusMessage: 'Incorrect Protocol',
    message: (payload) => {
      return addName(payload.route) + 'Target function is not observable.'
    },
  },
  [BasedErrorCode.FunctionIsObservable]: {
    statusCode: 400,
    statusMessage: 'Incorrect Protocol',
    message: (payload) => {
      return addName(payload.route) + 'Target function is observable.'
    },
  },
  [BasedErrorCode.FunctionIsStream]: {
    statusCode: 400,
    statusMessage: 'Incorrect Protocol',
    message: (payload) => {
      return addName(payload.route) + 'Target function is stream.'
    },
  },
  [BasedErrorCode.CannotStreamToObservableFunction]: {
    statusCode: 400,
    statusMessage: 'Incorrect Protocol',
    message: (payload) => {
      return addName(payload.route) + 'Cannot stream to observable function.'
    },
  },
  [BasedErrorCode.FunctionIsWrongType]: {
    statusCode: 400,
    statusMessage: 'Incorrect Protocol',
    message: (payload) => {
      return addName(payload.route) + 'Target function is of wrong type.'
    },
  },
  [BasedErrorCode.AuthorizeRejectedError]: {
    statusCode: 403,
    statusMessage: 'Forbidden',
    message: (payload) => addName(payload.route) + `Authorize rejected access.`,
  },
  [BasedErrorCode.InvalidPayload]: {
    statusCode: 400,
    statusMessage: 'Bad Request',
    message: (payload) => addName(payload.route) + 'Invalid payload.',
  },
  [BasedErrorCode.PayloadTooLarge]: {
    statusCode: 413,
    statusMessage: 'Payload Too Large',
    message: (payload) => addName(payload.route) + ' PayloadTooLarge.',
  },
  [BasedErrorCode.ChunkTooLarge]: {
    statusCode: 413,
    statusMessage: 'Payload Too Large',
    message: (payload) => addName(payload) + 'ChunkTooLarge ' + payload.name + '.',
  },
  [BasedErrorCode.UnsupportedContentEncoding]: {
    statusCode: 400,
    statusMessage: 'Incorrect content encoding',
    message: (payload) => addName(payload) + 'Incorrect content encoding.',
  },
  [BasedErrorCode.NoBinaryProtocol]: {
    statusCode: 400,
    statusMessage: 'Protocol mismatch',
    message: () => 'Please upgrade to the latest based client.',
  },
  [BasedErrorCode.LengthRequired]: {
    statusCode: 411,
    statusMessage: 'Length Required',
    message: (payload) => addName(payload) + 'Length Required.',
  },
  [BasedErrorCode.MethodNotAllowed]: {
    statusCode: 405,
    statusMessage: 'Method Not Allowed',
    message: (payload) => addName(payload) + 'Method Not Allowed.',
  },
  [BasedErrorCode.RateLimit]: {
    statusCode: 429,
    statusMessage: 'Rate limit',
    message: () => 'Rate limit.',
  },
  [BasedErrorCode.MissingAuthStateProtocolHeader]: {
    statusCode: 500,
    statusMessage: 'Internal Server Error',
    message: () => '',
  },
  [BasedErrorCode.IncorrectAccessKey]: {
    statusCode: 429,
    statusMessage: 'Rate limit',
    message: () => 'Rate limit.',
  },
  [BasedErrorCode.Block]: {
    statusCode: 429,
    statusMessage: 'Blocked ip',
    message: () => 'Blocked ip.',
  },
}

export const EMPTY_ROUTE: BasedRoute = {
  name: 'no-route',
  path: '',
  type: 'function',
}

function isServerError(
  payload: {} | BasedErrorPayload | BasedParseErrorPayload
): payload is BasedErrorPayload {
  return (payload as BasedErrorPayload).route !== undefined
}

export function createErrorData<T extends BasedErrorCode>(
  code: T,
  payload: ErrorPayload[T]
) {
  const type = errorTypeHandlers[code]
  const route = !payload
    ? EMPTY_ROUTE
    : isAnyBasedRoute(payload)
      ? payload
      : 'route' in payload
        ? payload.route
        : EMPTY_ROUTE

  return {
    code,
    message: type.message(payload),
    ...(isServerError(payload) ? {
      statusCode: type.statusCode,
      statusMessage: type.statusMessage,
      route: {
        name: route.name,
        path: route.path,
        type: route.type,
      },
    } : null)
  }
}

export class BasedError extends Error {
  public statusMessage?: string
  public code?: BasedErrorCode
}

export const convertDataToBasedError = (
  payload: BasedErrorData,
  stack?: string
): BasedError => {
  if (!payload || typeof payload !== 'object') {
    const err = new BasedError(`Payload: ${payload}`)
    // err.code = BasedErrorCode.FunctionError
    err.name = 'Invalid returned payload'
    return err
  }
  const { message, code } = payload
  const msg = message
    ? message[0] === '['
      ? message
      : `[${BasedErrorCode[code]}] ` + message
    : !code
      ? JSON.stringify(payload, null, 2)
      : 'Cannot read error msg'
  const error = new BasedError(msg)
  error.stack = stack ? msg + ' ' + stack : msg
  error.name = BasedErrorCode[code]
  error.code = code
  return error
}

// export const errorDescriptions: {
//   [BasedErrorCode.PrefixAlreadyInUse]: (payload) =>
//     `Prefix${payload?.prefix ? ` ${payload.prefix}` : ''} is already in use.`,
// }
// export const makeException = (error: BasedError) => new BasedException(error)
