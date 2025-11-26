import { isAnyBasedRoute, type BasedRoute } from '../functions/index.js'
import {
  BasedErrorCode,
  ErrorHandler,
  BasedErrorPayload,
  BasedParseErrorPayload,
  ErrorPayload,
} from './types.js'

const addName = (
  payload: { name: string } & { [key: string]: unknown },
): string => {
  return payload.name ? `[${payload.name}] ` : ''
}

type ErrorType = {
  [K in BasedErrorCode]: ErrorHandler<K>
}

export const errorTypeHandlers: ErrorType = {
  // Parse errors
  [BasedErrorCode.incorrectFieldType]: {
    message: (payload) => `[${payload.path.join('.')}] Incorrect field type.`,
  },
  [BasedErrorCode.incorrectNodeType]: {
    message: (payload) => `[${payload.path.join('.')}] Incorrect node type.`,
  },
  [BasedErrorCode.exceedsMaximum]: {
    message: (payload) =>
      `[${payload.path.join('.')}] Exceeds maximum property.`,
  },
  [BasedErrorCode.subceedsMinimum]: {
    message: (payload) =>
      `[${payload.path.join('.')}] Subceeds minimum property.`,
  },
  [BasedErrorCode.fieldDoesNotExist]: {
    message: (payload) => `[${payload.path.join('.')}] Field does not exist.`,
  },
  [BasedErrorCode.incorrectFormat]: {
    message: (payload) => `[${payload.path.join('.')}] Incorrect format.`,
  },
  [BasedErrorCode.referenceIsIncorrectType]: {
    message: (payload) =>
      `[${payload.path.join('.')}] Reference is from incorrect type.`,
  },
  [BasedErrorCode.valueAndDefault]: {
    message: (payload) =>
      `[${payload.path.join(
        '.',
      )}] Value and $default are being used at the same time.`,
  },
  [BasedErrorCode.defaultNotSupported]: {
    message: (payload) =>
      `[${payload.path.join('.')}] $default is not suported.`,
  },
  [BasedErrorCode.multipleOperationsNotAllowed]: {
    message: (payload) =>
      `[${payload.path.join('.')}] Multiple operations are not allowed here.`,
  },
  [BasedErrorCode.requiredFieldNotDefined]: {
    message: (payload) =>
      `[${payload.path.join('.')}] Required field is not defined.`,
  },
  [BasedErrorCode.languageNotSupported]: {
    message: (payload) => `[${payload.path.join('.')}] Language not supported.`,
  },
  [BasedErrorCode.invalidJSON]: {
    message: (payload) => `[${payload.path.join('.')}] Invalid JSON.`,
  },
  [BasedErrorCode.noLanguageFound]: {
    message: (payload) => `[${payload.path.join('.')}] No language found.`,
  },
  [BasedErrorCode.cannotDeleteNodeFromModify]: {
    message: (payload) =>
      `[${payload.path.join('.')}] Cannot delete node from modify.`,
  },
  [BasedErrorCode.nestedModifyObjectNotAllowed]: {
    message: (payload) =>
      `[${payload.path.join('.')}] Nested modify object not allowed.`,
  },
  [BasedErrorCode.infinityNotSupported]: {
    message: (payload) => `[${payload.path.join('.')}] Infinity not supported.`,
  },
  [BasedErrorCode.invalidSchemaFormat]: {
    message: (payload) => `[${payload.path.join('.')}] Invalid schema format.`,
  },
  [BasedErrorCode.invalidProperty]: {
    message: (payload) => `[${payload.path.join('.')}] Invalid property.`,
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
        `${
          payload.err.name && payload.err.name !== 'Error'
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
        `${
          payload.err.name && payload.err.name !== 'Error'
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
      payload: ErrorPayload[BasedErrorCode.NoOservableCacheAvailable],
    ) =>
      addName(payload.route) +
      `No observable cache available${payload.route.name} - ${payload.observableId}.`,
  },
  [BasedErrorCode.ObservableFunctionError]: {
    statusCode: 500,
    statusMessage: 'Internal Server Error',
    message: (payload) => {
      if (typeof payload.err === 'string' || !payload.err.message) {
        return `[${payload.route.name} (observable)] ${JSON.stringify(
          payload.err,
        )}.`
      }
      return (
        addName(payload.route) +
        `${
          payload.err.name && payload.err.name !== 'Error'
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
        `Function not found${
          payload.route.path ? ` path '${payload.route.path}'` : ''
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
    message: (payload) =>
      addName(payload) + 'ChunkTooLarge ' + payload.name + '.',
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

  [BasedErrorCode.PrefixAlreadyInUse]: {
    message: (payload) => `[${payload.path.join('.')}] Prefix already in use.`,
  },
  [BasedErrorCode.CannotChangeFieldInStrictMode]: {
    message: (payload) =>
      `[${payload.path.join('.')}] Cannot change field in strict mode.`,
  },
  [BasedErrorCode.CannotRemoveFieldInStrictMode]: {
    message: (payload) =>
      `[${payload.path.join('.')}] Cannot remove field in strict mode.`,
  },
  [BasedErrorCode.CannotMutateWithExistingData]: {
    message: (payload) =>
      `[${payload.path.join('.')}] Cannot mutate with existing data.`,
  },
  [BasedErrorCode.CannotDeleteRoot]: {
    message: (payload) => `[${payload.path.join('.')}] Cannot delete root.`,
  },
  [BasedErrorCode.CannotChangeDefaultField]: {
    message: (payload) =>
      `[${payload.path.join('.')}] Cannot change default field.`,
  },
  [BasedErrorCode.CannotRemoveLastProperty]: {
    message: (payload) =>
      `[${payload.path.join('.')}] Cannot remove last property.`,
  },
}

export const EMPTY_ROUTE: BasedRoute = {
  name: 'no-route',
  path: '',
  type: 'function',
}

function isServerError(
  payload: {} | BasedErrorPayload | BasedParseErrorPayload,
): payload is BasedErrorPayload {
  return (payload as BasedErrorPayload).route !== undefined
}

export function createErrorData<T extends BasedErrorCode>(
  code: T,
  payload: ErrorPayload[T],
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
    ...(isServerError(payload)
      ? {
          statusCode: type.statusCode,
          statusMessage: type.statusMessage,
          route: {
            name: route.name,
            path: route.path,
            type: route.type,
          },
        }
      : null),
  }
}

export * from './types.js'

export * from './BasedError.js'

export * from './convertDataToBasedError.js'

// export const errorDescriptions: {
//   [BasedErrorCode.PrefixAlreadyInUse]: (payload) =>
//     `Prefix${payload?.prefix ? ` ${payload.prefix}` : ''} is already in use.`,
// }
// export const makeException = (error: BasedError) => new BasedException(error)
