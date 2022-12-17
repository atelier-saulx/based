import { BasedServer } from '../server'
import { BasedFunctionRoute } from '../functions'
import { Context } from '../client'
import {
  BasedErrorCode,
  ErrorPayload,
  BasedErrorData,
  EMPTY_ROUTE,
} from './types'

import { errorTypeHandlers } from './errorTypeHandlers'
export * from './types'

const isBasedFunctionRoute = (route: any): route is BasedFunctionRoute => {
  if (route && typeof route === 'object' && 'name' in route) {
    return true
  }
  return false
}

export function createError<T extends BasedErrorCode>(
  server: BasedServer,
  context: Context,
  code: T,
  payload: ErrorPayload[T]
): BasedErrorData<T> {
  const type = errorTypeHandlers[code]

  const route = !payload
    ? EMPTY_ROUTE
    : isBasedFunctionRoute(payload)
    ? payload
    : 'route' in payload
    ? payload.route
    : EMPTY_ROUTE

  const errorData: BasedErrorData<T> = {
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

  if ('err' in payload) {
    server.emit('error', context, errorData, payload.err)
  } else {
    server.emit('error', context, errorData)
  }

  return errorData
}
