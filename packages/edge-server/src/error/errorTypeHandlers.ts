import { BasedFunctionRoute } from '../types'
import { BasedErrorCode, ErrorPayload, ErrorHandler } from './types'

const addName = (payload: BasedFunctionRoute): string => {
  return payload.name ? `[${payload.name}] ` : ''
}

type ErrorType = {
  [K in BasedErrorCode]: ErrorHandler<K>
}

export const errorTypeHandlers: ErrorType = {
  [BasedErrorCode.FunctionError]: {
    statusCode: 500,
    statusMessage: 'Internal Server Error',
    message: (payload) => {
      if (!payload.err.message) {
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
  [BasedErrorCode.ObservableFunctionError]: {
    statusCode: 500,
    statusMessage: 'Internal Server Error',
    message: (payload) => {
      if (payload.err && !payload.err.message && !payload.err.name) {
        return `[${payload.route.name}] ${JSON.stringify(payload.err)}`
      }
      return `[${payload.route.name}] ${
        payload.err.name && payload.err.name !== 'Error'
          ? `[${payload.err.name}] `
          : ''
      }${payload.err.message || ''}`
    },
  },
  [BasedErrorCode.FunctionNotFound]: {
    statusCode: 404,
    statusMessage: 'Not Found',
    message: (payload) => {
      return (
        addName(payload) +
        `Function not found${payload.path ? ` path '${payload.path}'` : ''}`
      )
    },
  },
  [BasedErrorCode.FunctionIsStream]: {
    statusCode: 400,
    statusMessage: 'Incorrect Protocol',
    message: (payload) => {
      return addName(payload) + 'Cannot use stream functions over websockets'
    },
  },
  [BasedErrorCode.FunctionIsNotObservable]: {
    statusCode: 400,
    statusMessage: 'Function Is Not Observable',
    message: (payload) =>
      addName(payload) + 'Cannot observe non observable functions',
  },
  [BasedErrorCode.FunctionIsObservable]: {
    statusCode: 400,
    statusMessage: 'Function Is Observable',
    message: (payload) =>
      addName(payload) + 'Cannot call observable functions as a standard one',
  },
  [BasedErrorCode.CannotStreamToObservableFunction]: {
    statusCode: 404,
    statusMessage: 'Not Found',
    message: (payload) => {
      return addName(payload) + 'Cannot stream to observable function'
    },
  },
  [BasedErrorCode.AuthorizeFunctionError]: {
    statusCode: 403,
    statusMessage: 'Forbidden',
    message: (payload) =>
      addName(payload.route) + 'Error in authorize function',
  },
  [BasedErrorCode.AuthorizeRejectedError]: {
    statusCode: 403,
    statusMessage: 'Forbidden',
    message: (payload) => addName(payload.route) + `Authorize rejected access`,
  },
  [BasedErrorCode.InvalidPayload]: {
    statusCode: 400,
    statusMessage: 'Bad Request',
    message: (payload) => addName(payload) + 'Invalid payload',
  },
  [BasedErrorCode.NoBinaryProtocol]: {
    statusCode: 400,
    statusMessage: 'Protocol mismatch',
    message: () => 'Please upgrade to the latest based client',
  },
  [BasedErrorCode.PayloadTooLarge]: {
    statusCode: 413,
    statusMessage: 'Payload Too Large',
    message: (payload) => addName(payload) + ' PayloadTooLarge',
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
