import { end } from './sendHttpResponse.js'
import { BasedServer } from './server.js'
import {
  HttpSession,
  WebSocketSession,
  Context,
  isHttpContext,
  isWsSession,
  BasedRoute,
} from '@based/functions'
import {
  valueToBuffer,
  encodeErrorResponse,
  valueToBufferV1,
} from './protocol.js'
import { createError } from './error/index.js'
import { BasedErrorCode, BasedErrorData, ErrorPayload } from '@based/errors'

const sendHttpErrorData = (
  errorData: BasedErrorData,
  ctx: Context<HttpSession>,
) => {
  const { code, message, statusCode, statusMessage } = errorData
  ctx.session.res.cork(() => {
    ctx.session.res.writeStatus(`${statusCode} ${statusMessage}`)
    if (ctx.session.method !== 'options') {
      ctx.session.res.writeHeader('Content-Type', 'application/json')
    }
    end(
      ctx,
      JSON.stringify({
        error: message,
        code,
      }),
    )
  })
}

export function sendHttpError<T extends BasedErrorCode>(
  server: BasedServer,
  ctx: Context<HttpSession>,
  basedCode: T,
  payload: ErrorPayload[T],
) {
  if (!ctx.session) {
    return
  }
  const errData = createError(server, ctx, basedCode, payload)
  sendHttpErrorData(errData, ctx)
}

export function sendErrorData(
  ctx: Context<WebSocketSession | HttpSession>,
  errorData: BasedErrorData,
): void {
  if (!ctx.session) {
    return
  }
  if (isHttpContext(ctx)) {
    sendHttpErrorData(errorData, ctx)
  } else if (isWsSession(ctx.session)) {
    ctx.session.ws.send(
      encodeErrorResponse(
        ctx.session.v < 2
          ? valueToBufferV1(errorData, true)
          : valueToBuffer(errorData, true),
      ),
      true,
      false,
    )
  }
}

export function sendError<T extends BasedErrorCode>(
  server: BasedServer,
  ctx: Context<WebSocketSession | HttpSession>,
  basedCode: T,
  payload: ErrorPayload[T],
): void {
  if (!ctx.session) {
    return
  }
  if (isHttpContext(ctx)) {
    return sendHttpError(server, ctx, basedCode, payload)
  } else if (isWsSession(ctx.session)) {
    const errorData = createError(server, ctx, basedCode, payload)
    ctx.session.ws.send(
      encodeErrorResponse(
        ctx.session.v < 2
          ? valueToBufferV1(errorData, true)
          : valueToBuffer(errorData, true),
      ),
      true,
      false,
    )
  }
}

export function sendSimpleError<T extends BasedErrorCode>(
  server: BasedServer,
  ctx: Context<WebSocketSession | HttpSession>,
  basedCode: T,
  route: BasedRoute,
  id?: number,
  payload?: ErrorPayload[T],
): void {
  if (!ctx.session) {
    return
  }
  if (!payload) {
    // @ts-ignore tmp for now
    payload = id
      ? route.type === 'query'
        ? {
            route,
            observableId: id,
          }
        : route.type === 'channel'
          ? {
              route,
              channelId: id,
            }
          : {
              route,
              requestId: id,
            }
      : { route }
  }

  if (isHttpContext(ctx)) {
    return sendHttpError(server, ctx, basedCode, payload)
  } else if (isWsSession(ctx.session)) {
    const errorData = createError(server, ctx, basedCode, payload)
    ctx.session.ws.send(
      encodeErrorResponse(
        ctx.session.v < 2
          ? valueToBufferV1(errorData, true)
          : valueToBuffer(errorData, true),
      ),
      true,
      false,
    )
  }
}
