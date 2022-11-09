import { BasedServer } from './server'
import { BasedFunctionRoute, HttpClient, WebsocketClient } from './types'

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
  [BasedErrorCode.NoBinaryProtocol]: any
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

const addName = (payload: BasedFunctionRoute): string => {
  return payload.name ? `[${payload.name}] ` : ''
}

type ErrorPayloadType = ErrorPayload[BasedErrorCode]

type ErorHandler = {
  statusCode: number
  statusMessage: string
  message: (payload: ErrorPayloadType) => string
}

const errorTypes: Record<keyof ErrorPayload, ErorHandler> = {
  [BasedErrorCode.FunctionError]: {
    statusCode: 500,
    statusMessage: 'Internal Server Error',
    message: (payload: ErrorPayload[BasedErrorCode.FunctionError]) => {
      // @ts-ignore
      if (payload.err && !payload.err.message && !payload.err.name) {
        // @ts-ignore
        return `[${payload.route.name}] ${JSON.stringify(payload.err)}`
      }
      return `[${payload.route.name}] ${
        payload.err.name && payload.err.name !== 'Error'
          ? `[${payload.err.name}] `
          : ''
      }${payload.err.message || ''}`
    },
  },
  [BasedErrorCode.ObservableFunctionError]: {
    statusCode: 500,
    statusMessage: 'Internal Server Error',
    message: (
      payload: ErrorPayload[BasedErrorCode.ObservableFunctionError]
    ) => {
      // @ts-ignore
      if (payload.err && !payload.err.message && !payload.err.name) {
        // @ts-ignore
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
    message: (payload: ErrorPayload[BasedErrorCode.FunctionNotFound]) => {
      return (
        addName(payload) +
        `Function not found${payload.path ? ` path '${payload.path}'` : ''}`
      )
    },
  },
  [BasedErrorCode.FunctionIsStream]: {
    statusCode: 400,
    statusMessage: 'Incorrect Protocol',
    message: (payload: ErrorPayload[BasedErrorCode.FunctionIsStream]) => {
      return addName(payload) + 'Cannot use stream functions over websockets'
    },
  },
  [BasedErrorCode.FunctionIsNotObservable]: {
    statusCode: 400,
    statusMessage: 'Function Is Not Observable',
    message: (
      payload: ErrorPayload[BasedErrorCode.FunctionIsNotObservable]
    ) => {
      return addName(payload) + 'Cannot observe non observable functions'
    },
  },
  [BasedErrorCode.FunctionIsObservable]: {
    statusCode: 400,
    statusMessage: 'Function Is Observable',
    message: (payload: ErrorPayload[BasedErrorCode.FunctionIsObservable]) => {
      return (
        addName(payload) + 'Cannot call observable functions as a standard one'
      )
    },
  },
  [BasedErrorCode.CannotStreamToObservableFunction]: {
    statusCode: 404,
    statusMessage: 'Not Found',
    // TODO: make this allways a function
    message: (
      payload: ErrorPayload[BasedErrorCode.CannotStreamToObservableFunction]
    ) => {
      return addName(payload) + 'Cannot stream to observable function'
    },
  },
  [BasedErrorCode.AuthorizeFunctionError]: {
    statusCode: 403,
    statusMessage: 'Forbidden',
    message: (payload: ErrorPayload[BasedErrorCode.AuthorizeFunctionError]) =>
      addName(payload.route) + 'Error in authorize function',
  },
  [BasedErrorCode.AuthorizeRejectedError]: {
    statusCode: 403,
    statusMessage: 'Forbidden',
    message: (payload: ErrorPayload[BasedErrorCode.AuthorizeRejectedError]) =>
      addName(payload) + `Authorize rejected access`,
  },
  [BasedErrorCode.InvalidPayload]: {
    statusCode: 400,
    statusMessage: 'Bad Request',
    message: (payload: ErrorPayload[BasedErrorCode.InvalidPayload]) =>
      addName(payload) + 'Invalid payload',
  },
  [BasedErrorCode.NoBinaryProtocol]: {
    statusCode: 400,
    statusMessage: 'Protocol mismatch',
    message: () => 'Please upgrade to the latest based client',
  },
  [BasedErrorCode.PayloadTooLarge]: {
    statusCode: 413,
    statusMessage: 'Payload Too Large',
    message: (payload: ErrorPayload[BasedErrorCode.PayloadTooLarge]) =>
      addName(payload) + ' PayloadTooLarge',
  },
  [BasedErrorCode.ChunkTooLarge]: {
    statusCode: 413,
    statusMessage: 'Payload Too Large',
    message: (payload: ErrorPayload[BasedErrorCode.ChunkTooLarge]) =>
      addName(payload) + 'ChunkTooLarge ' + payload.name,
  },
  [BasedErrorCode.UnsupportedContentEncoding]: {
    statusCode: 400,
    statusMessage: 'Incorrect content encoding',
    message: (
      payload: ErrorPayload[BasedErrorCode.UnsupportedContentEncoding]
    ) => addName(payload) + 'Incorrect content encoding',
  },
  [BasedErrorCode.LengthRequired]: {
    statusCode: 411,
    statusMessage: 'Length Required',
    message: (payload: ErrorPayload[BasedErrorCode.LengthRequired]) =>
      addName(payload) + 'Length Required',
  },
  [BasedErrorCode.MethodNotAllowed]: {
    statusCode: 405,
    statusMessage: 'Method Not Allowed',
    message: (payload: ErrorPayload[BasedErrorCode.MethodNotAllowed]) =>
      addName(payload) + 'Method Not Allowed',
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

const isBasedFunctionRoute = (route: any): route is BasedFunctionRoute => {
  if (route && typeof route === 'object' && 'name' in route) {
    return true
  }
  return false
}
const EMPTY = {
  route: {
    name: 'no-route',
  },
}

export const createError = (
  server: BasedServer,
  client: HttpClient | WebsocketClient,
  code: BasedErrorCode,
  payload: ErrorPayload[BasedErrorCode]
): BasedErrorData => {
  const type: ErorHandler = errorTypes[code]

  const route = !payload
    ? EMPTY.route
    : isBasedFunctionRoute(payload)
    ? payload
    : payload.route

  const errorData: BasedErrorData = {
    code,
    statusCode: type.statusCode,
    statusMessage: type.statusMessage,
    message: type.message(payload),
    route: {
      name: route.name,
      path: route.path,
    },
  }

  if ('requestId' in payload) {
    errorData.requestId = payload.requestId
  }

  if ('observableId' in payload) {
    errorData.observableId = payload.observableId
  }

  if (payload?.err) {
    server.emit('error', client, errorData, payload.err)
  } else {
    server.emit('error', client, errorData)
  }

  return errorData
}
