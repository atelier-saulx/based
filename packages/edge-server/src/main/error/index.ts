import { BasedServer } from '../server'
import {
  BasedFunctionRoute,
  HttpClient,
  WebsocketClient,
  WorkerClient,
  isHttpClient,
  ObservableDummyClient,
} from '../../types'
import { valueToBuffer, encodeErrorResponse } from '../../protocol'
import {
  BasedErrorCode,
  ErrorPayload,
  BasedErrorData,
  EMPTY_ROUTE,
} from './types'
import uws from '@based/uws'
import { end } from '../sendHttpResponse'
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
  client: HttpClient | WebsocketClient | WorkerClient | ObservableDummyClient,
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
    server.emit('error', client, errorData, payload.err)
  } else {
    server.emit('error', client, errorData)
  }

  return errorData
}

// --------- send error ------------------------

const sendHttpErrorMessage = (
  res: uws.HttpResponse,
  error: BasedErrorData
): string => {
  const { code, message, statusCode, statusMessage } = error
  res.writeStatus(`${statusCode} ${statusMessage}`)
  res.writeHeader('Access-Control-Allow-Origin', '*')
  res.writeHeader('Access-Control-Allow-Headers', 'content-type')
  res.writeHeader('Content-Type', 'application/json')
  return JSON.stringify({
    error: message,
    code,
  })
}

export function sendHttpError<T extends BasedErrorCode>(
  server: BasedServer,
  client: HttpClient,
  basedCode: T,
  payload: ErrorPayload[T]
) {
  if (!client.res) {
    return
  }
  client.res.cork(() => {
    end(
      client,
      sendHttpErrorMessage(
        client.res,
        createError(server, client, basedCode, payload)
      )
    )
  })
}

export function sendError<T extends BasedErrorCode>(
  server: BasedServer,
  client: WebsocketClient | HttpClient,
  basedCode: T,
  payload: ErrorPayload[T]
): void {
  if (isHttpClient(client)) {
    return sendHttpError(server, client, basedCode, payload)
  }
  const errorData = createError(server, client, basedCode, payload)
  client.ws?.send(encodeErrorResponse(valueToBuffer(errorData)), true, false)
}
