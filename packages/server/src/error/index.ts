import {
  BasedErrorCode,
  ErrorPayload,
  BasedErrorData,
  EMPTY_ROUTE,
} from './types'
import { isBasedFunctionRoute } from '../types'
import { errorTypeHandlers } from './errorTypeHandlers'
export * from './types'

export function createError<T extends BasedErrorCode>(
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

  return errorData
}
