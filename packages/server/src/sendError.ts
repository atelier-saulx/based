import uws from '@based/uws'
import { end } from './sendHttpResponse'
import { BasedServer } from './server'
import {
  HttpSession,
  WebSocketSession,
  Context,
  isHttpContext,
  isWsSession,
} from './context'
import { valueToBuffer, encodeErrorResponse } from './protocol'
import {
  BasedErrorCode,
  ErrorPayload,
  BasedErrorData,
  createError,
} from './error'

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
  ctx: Context<HttpSession>,
  basedCode: T,
  payload: ErrorPayload[T]
) {
  if (!ctx.session) {
    return
  }
  ctx.session.res.cork(() => {
    end(
      ctx,
      sendHttpErrorMessage(
        ctx.session.res,
        createError(server, ctx, basedCode, payload)
      )
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
