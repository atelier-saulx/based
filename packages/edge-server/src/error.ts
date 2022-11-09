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

type FunctionErrorProps =
  | {
      err: Error
      requestId?: number
      route: BasedFunctionRoute
    }
  | {
      observableId: number
      err: Error
      route: BasedFunctionRoute
    }

// TODO: need to add reqId & observableId as well.. else you cannot handle them at all

export type ErrorPayload = {
  [BasedErrorCode.NoBinaryProtocol]: any
  [BasedErrorCode.FunctionError]: FunctionErrorProps // TODO include payload
  [BasedErrorCode.AuthorizeFunctionError]: FunctionErrorProps
  [BasedErrorCode.NoOservableCacheAvailable]: {
    observableId: number
    route: BasedFunctionRoute
  }
  [BasedErrorCode.ObservableFunctionError]: {
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

/*
  for functione errors

 // errorData.basedMessage =
  //   typeof errorDefaults[basedCode]?.message === 'function'
  //     ? errorDefaults[basedCode]?.message(err)
  //     : errorDefaults[basedCode]?.message ||
  //       errorDefaults[basedCode]?.status ||
  //       'Oops something went wrong'
  //   if (payload && 'err' in payload && payload instanceof Error) {
  //     Object.getOwnPropertyNames(payload.err).forEach((key: string) => {
  //       errorData[key] = payload.err[key]
  //     })
  //   } else {
  //     errorData.message = errorData.basedMessage
  //     const captureTarget = { stack: null }
  //     Error.captureStackTrace(captureTarget, createError)
  //     errorData.stack = captureTarget.stack
  //   }
  // }
*/

const errorTypes = {
  [BasedErrorCode.FunctionError]: {
    statusCode: 500,
    statusMessage: 'Internal Server Error',
    message: (payload: ErrorPayload[BasedErrorCode.FunctionError]) => {
      // do it nice
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
    message: (payload: ErrorPayload[BasedErrorCode.FunctionNotFound]) =>
      `Function not found${payload.name ? ` '${payload.name}'` : ''}${
        payload.path ? ` path '${payload.path}'` : ''
      }`,
  },
  [BasedErrorCode.FunctionIsStream]: {
    statusCode: 400,
    statusMessage: 'Incorrect protocol',
    message: () => 'Cannot use stream functions over websockets',
  },
  [BasedErrorCode.CannotStreamToObservableFunction]: {
    statusCode: 404,
    statusMessage: 'Not Found',
    // TODO: make this allways a function
    message: 'Cannot stream to observable function.',
  },
  [BasedErrorCode.AuthorizeFunctionError]: {
    statusCode: 403,
    statusMessage: 'Forbidden',
    message: 'Error in authorize function',
  },
  [BasedErrorCode.AuthorizeRejectedError]: {
    statusCode: 403,
    statusMessage: 'Forbidden',
    message: (payload: ErrorPayload[BasedErrorCode.AuthorizeRejectedError]) =>
      `Authorize rejected access to ${payload.name}`,
  },
  [BasedErrorCode.InvalidPayload]: {
    statusCode: 400,
    statusMessage: 'Bad Request',
    message: (payload: ErrorPayload[BasedErrorCode.InvalidPayload]) =>
      'Invalid payload ' + payload.name,
  },
  [BasedErrorCode.NoBinaryProtocol]: {
    statusCode: 400,
    statusMessage: 'Protocol mismatch',
    message: () => 'Please upgrade to the latest based client',
  },
  [BasedErrorCode.PayloadTooLarge]: {
    statusCode: 413,
    status: 'Payload Too Large',
    message: (payload: ErrorPayload[BasedErrorCode.PayloadTooLarge]) =>
      'PayloadTooLarge ' + payload.name,
  },
  [BasedErrorCode.ChunkTooLarge]: {
    statusCode: 413,
    status: 'Payload Too Large',
    message: (payload: ErrorPayload[BasedErrorCode.ChunkTooLarge]) =>
      'ChunkTooLarge ' + payload.name,
  },
  [BasedErrorCode.UnsupportedContentEncoding]: {
    statusCode: 400,
    statusMessage: 'Incorrect content encoding',
  },
  [BasedErrorCode.LengthRequired]: { code: 411, status: 'Length Required' },
  [BasedErrorCode.MethodNotAllowed]: {
    statusCode: 405,
    statusMessage: 'Method Not Allowed',
  },
  [BasedErrorCode.NoOservableCacheAvailable]: {
    statusCode: 500,
    statusMessage: 'Internal Server Error',
    message: (
      payload: ErrorPayload[BasedErrorCode.NoOservableCacheAvailable]
    ) =>
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
  const type = errorTypes[code]

  const route = !payload
    ? EMPTY.route
    : isBasedFunctionRoute(payload)
    ? payload
    : payload.route

  const errorData: BasedErrorData = {
    code,
    statusCode: type.statusCode,
    statusMessage: type.statusMessage,
    message:
      typeof type.message === 'function' ? type.message(payload) : type.message,
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
