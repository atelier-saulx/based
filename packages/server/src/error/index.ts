import { BasedServer } from '../server.js'
import { Context, isAnyBasedRoute } from '@based/functions'
import {
  BasedErrorCode,
  ErrorPayload,
  BasedErrorData,
  EMPTY_ROUTE,
} from './types.js'

import { errorTypeHandlers } from './errorTypeHandlers.js'
export * from './types.js'

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
    statusCode: type.statusCode,
    statusMessage: type.statusMessage,
    message: type.message(payload),
    route: {
      name: route.name,
      path: route.path,
      type: route.type,
    },
  }
}

export function createError<T extends BasedErrorCode>(
  server: BasedServer,
  context: Context,
  code: T,
  payload: ErrorPayload[T]
): BasedErrorData<T> {
  const errorData: BasedErrorData<T> = createErrorData(code, payload)
  if ('requestId' in payload) {
    errorData.requestId = payload.requestId
  } else if ('observableId' in payload) {
    errorData.observableId = payload.observableId
  } else if ('channelId' in payload) {
    errorData.channelId = payload.channelId
  }

  if ('err' in payload) {
    server.emit('error', context, errorData, payload.err)
  } else {
    server.emit('error', context, errorData)
  }
  return errorData
}
