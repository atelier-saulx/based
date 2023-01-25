import {
  valueToBuffer,
  decodePayload,
  encodeAuthResponse,
} from '../../protocol'
import { BasedServer } from '../../server'
import { WebSocketSession, Context } from '../../context'
import { enableSubscribe } from './observable'
import { parseAuthState, AuthState } from '../../auth'
import { rateLimitRequest } from '../../security'

const sendAuthMessage = (ctx: Context<WebSocketSession>, payload: any) =>
  ctx.session?.send(encodeAuthResponse(valueToBuffer(payload)), true, false)

export const authMessage = (
  arr: Uint8Array,
  start: number,
  len: number,
  isDeflate: boolean,
  ctx: Context<WebSocketSession>,
  server: BasedServer
): boolean => {
  // TODO: Allow AUTH to be called over http to refresh a token

  // | 4 header | * payload |
  const authPayload = decodePayload(
    new Uint8Array(arr.slice(start + 4, start + len)),
    isDeflate
  )

  if (rateLimitRequest(server, ctx, 10, server.rateLimit.ws)) {
    ctx.session.close()
    return false
  }

  const authState: AuthState = parseAuthState(authPayload)

  const verified = server.auth.verifyAuthState(server, ctx)

  if (verified !== true && verified.error) {
    sendAuthMessage(ctx, verified)
    return true
  }

  ctx.session.authState = authState
  if (ctx.session.unauthorizedObs.size) {
    ctx.session.unauthorizedObs.forEach((obs) => {
      const { id, name, checksum, payload } = obs
      enableSubscribe(server, ctx, id, checksum, name, payload, {
        name,
      })
    })
    ctx.session.unauthorizedObs.clear()
  }

  sendAuthMessage(ctx, verified)
  return true
}

// send and verify
export const sendAndVerifyAuthMessage = (
  server: BasedServer,
  ctx: Context<WebSocketSession>
) => {
  if (!ctx.session) {
    return
  }

  const verified = server.auth.verifyAuthState(server, ctx)

  if (verified === true) {
    sendAuthMessage(ctx, true)
    return
  }

  if (verified.error) {
    sendAuthMessage(ctx, false)
    return
  }

  sendAuthMessage(ctx, verified)
}
