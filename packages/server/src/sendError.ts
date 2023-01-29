import { end } from './sendHttpResponse'
import { BasedServer } from './server'
import {
  HttpSession,
  WebSocketSession,
  Context,
  isHttpContext,
  isWsSession,
} from '@based/functions'
import { valueToBuffer, encodeErrorResponse } from './protocol'
import { BasedErrorCode, ErrorPayload, createError } from './error'

export function sendHttpError<T extends BasedErrorCode>(
  server: BasedServer,
  ctx: Context<HttpSession>,
  basedCode: T,
  payload: ErrorPayload[T]
) {
  if (!ctx.session) {
    return
  }
  ctx.session.res.cork(() => {
    const { code, message, statusCode, statusMessage } = createError(
      server,
      ctx,
      basedCode,
      payload
    )
    ctx.session.res.writeStatus(`${statusCode} ${statusMessage}`)
    if (ctx.session.method !== 'options') {
      ctx.session.res.writeHeader('Content-Type', 'application/json')
    }
    end(
      ctx,
      JSON.stringify({
        error: message,
        code,
      })
    )
  })
}

export function sendError<T extends BasedErrorCode>(
  server: BasedServer,
  ctx: Context<WebSocketSession | HttpSession>,
  basedCode: T,
  payload: ErrorPayload[T]
): void {
  if (!ctx.session) {
    return
  }
  if (isHttpContext(ctx)) {
    return sendHttpError(server, ctx, basedCode, payload)
  } else if (isWsSession(ctx.session)) {
    const errorData = createError(server, ctx, basedCode, payload)
    const ws: WebSocketSession = ctx.session
    ws.send(encodeErrorResponse(valueToBuffer(errorData)), true, false)
  }
}
