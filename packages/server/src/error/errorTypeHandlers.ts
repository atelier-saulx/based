import { BasedErrorCode, ErrorPayload, ErrorHandler } from './types.js'

const addName = (
  payload: { name: string } & { [key: string]: unknown }
): string => {
  return payload.name ? `[${payload.name}] ` : ''
}

type ErrorType = {
  [K in BasedErrorCode]: ErrorHandler<K>
}

export const errorTypeHandlers: ErrorType = {
  [BasedErrorCode.MissingAuthStateProtocolHeader]: {
    statusCode: 500,
    statusMessage: 'Internal Server Error',
    message: () => '',
  },
  [BasedErrorCode.RateLimit]: {
    statusCode: 429,
    statusMessage: 'Rate limit',
    message: () => 'rate limt',
  },
  [BasedErrorCode.Block]: {
    statusCode: 429,
    statusMessage: 'Blocked ip',
    message: () => 'Blocked ip',
  },
  [BasedErrorCode.IncorrectAccessKey]: {
    statusCode: 429,
    statusMessage: 'Rate limit',
    message: () => 'rate limt',
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
        }${payload.err.message || ''}`
      )
    },
  },
  [BasedErrorCode.ObserveCallbackError]: {
    statusCode: 500,
    statusMessage: 'Internal Server Error',
    message: () => {
      return 'Error in server side observer'
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
        }`
      )
    },
  },
  [BasedErrorCode.FunctionIsWrongType]: {
    statusCode: 400,
    statusMessage: 'Incorrect Protocol',
    message: (payload) => {
      return addName(payload.route) + 'Target function is of wrong type'
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
        }${payload.err.message || ''}`
      )
    },
  },
  [BasedErrorCode.AuthorizeRejectedError]: {
    statusCode: 403,
    statusMessage: 'Forbidden',
    message: (payload) => addName(payload.route) + `Authorize rejected access`,
  },
  [BasedErrorCode.InvalidPayload]: {
    statusCode: 400,
    statusMessage: 'Bad Request',
    message: (payload) => addName(payload.route) + 'Invalid payload',
  },
  [BasedErrorCode.NoBinaryProtocol]: {
    statusCode: 400,
    statusMessage: 'Protocol mismatch',
    message: () => 'Please upgrade to the latest based client',
  },
  [BasedErrorCode.PayloadTooLarge]: {
    statusCode: 413,
    statusMessage: 'Payload Too Large',
    message: (payload) => addName(payload.route) + ' PayloadTooLarge',
  },
  [BasedErrorCode.ChunkTooLarge]: {
    statusCode: 413,
    statusMessage: 'Payload Too Large',
    message: (payload) => addName(payload) + 'ChunkTooLarge ' + payload.name,
  },
  [BasedErrorCode.UnsupportedContentEncoding]: {
    statusCode: 400,
    statusMessage: 'Incorrect content encoding',
    message: (payload) => addName(payload) + 'Incorrect content encoding',
  },
  [BasedErrorCode.LengthRequired]: {
    statusCode: 411,
    statusMessage: 'Length Required',
    message: (payload) => addName(payload) + 'Length Required',
  },
  [BasedErrorCode.MethodNotAllowed]: {
    statusCode: 405,
    statusMessage: 'Method Not Allowed',
    message: (payload) => addName(payload) + 'Method Not Allowed',
  },
  [BasedErrorCode.NoOservableCacheAvailable]: {
    statusCode: 500,
    statusMessage: 'Internal Server Error',
    message: (
      payload: ErrorPayload[BasedErrorCode.NoOservableCacheAvailable]
    ) =>
      addName(payload.route) +
      `No observable cache available${payload.route.name} - ${payload.observableId}`,
  },
}
