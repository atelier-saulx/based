import {
  valueToBuffer,
  decodePayload,
  encodeAuthResponse,
} from '../../protocol'
import { BasedServer } from '../../server'
import { WebSocketSession, Context } from '../../context'
import { enableSubscribe } from './observable'
import { parseAuthState } from '../../auth'
import { rateLimitRequest } from '../../security'

export type AuthState = any

export const authMessage = (
  arr: Uint8Array,
  start: number,
  len: number,
  isDeflate: boolean,
  ctx: Context<WebSocketSession>,
  server: BasedServer
): boolean => {
  // TODO: Check refresh etc here!
  // TODO: Allow AUTH to be calleed in http to refresh a token
  // include an REQ-ID in the auth request

  // | 4 header | * payload |
  const authPayload = decodePayload(
    new Uint8Array(arr.slice(start + 4, start + len)),
    isDeflate
  )

  // 10 rate limit tokens for auth (very strange when this gets called often)
  if (rateLimitRequest(server, ctx, 10, server.rateLimit.ws)) {
    ctx.session.close()
    return false
  }

  const authState: AuthState = parseAuthState(authPayload)
  ctx.session.authState = authState
  if (ctx.session.unauthorizedObs.size) {
    ctx.session.unauthorizedObs.forEach((obs) => {
      const { id, name, checksum, payload } = obs
      enableSubscribe(server, ctx, id, checksum, name, payload, {
        name: 'internal-websocket-auth',
      })
    })
    ctx.session.unauthorizedObs.clear()
  }
  // TODO needs to call refresh mechanism or something also need that on HTTP
  ctx.session.send(encodeAuthResponse(valueToBuffer(true)), true, false)
  return true
}

export const sendAuthMessage = (ctx: Context<WebSocketSession>) => {
  // TODO needs to call refresh mechanism or something
  ctx.session.send(encodeAuthResponse(valueToBuffer(true)), true, false)
}