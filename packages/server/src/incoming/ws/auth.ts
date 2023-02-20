import {
  valueToBuffer,
  decodePayload,
  encodeAuthResponse,
} from '../../protocol'
import { BasedServer } from '../../server'
import { enableSubscribe } from './observable'
import { rateLimitRequest } from '../../security'
import { AuthState, WebSocketSession, Context } from '@based/functions'
import { BinaryMessageHandler } from './types'
import { enableChannelSubscribe } from './channelSubscribe'

const sendAuthMessage = (ctx: Context<WebSocketSession>, payload: any) =>
  ctx.session?.send(encodeAuthResponse(valueToBuffer(payload)), true, false)

const parse = (payload: string) => {
  try {
    return JSON.parse(payload)
  } catch (err) {
    return { error: 'invalid token' }
  }
}

export const authMessage: BinaryMessageHandler = (
  arr,
  start,
  len,
  isDeflate,
  ctx,
  server
) => {
  if (rateLimitRequest(server, ctx, 10, server.rateLimit.ws)) {
    ctx.session.close()
    return false
  }

  // | 4 header | * payload |
  const payload = decodePayload(
    new Uint8Array(arr.slice(start + 4, start + len)),
    isDeflate
  )

  const authState: AuthState = parse(payload)

  const verified = server.auth.verifyAuthState(server.client, ctx, authState)

  const session = ctx.session.getUserData()
  session.authState = verified === true ? authState : verified

  if (verified !== true && verified.error) {
    sendAuthMessage(ctx, verified)
    return true
  }

  if (session.unauthorizedObs?.size) {
    session.unauthorizedObs.forEach((obs) => {
      const { id, name, checksum, payload } = obs
      enableSubscribe(
        {
          name,
          query: true,
        },
        server,
        ctx,
        payload,
        id,
        checksum
      )
    })
    session.unauthorizedObs.clear()
  }

  if (session.unauthorizedChannels?.size) {
    session.unauthorizedChannels.forEach((channel) => {
      const { id, name, payload } = channel
      enableChannelSubscribe(
        {
          name,
          channel: true,
        },
        server,
        ctx,
        payload,
        id
      )
    })
    session.unauthorizedChannels.clear()
  }

  sendAuthMessage(ctx, verified)
  return true
}

// send and verify
export const sendAndVerifyAuthMessage = (
  server: BasedServer,
  ctx: Context<WebSocketSession>
) => {
  const session = ctx.session.getUserData()

  if (!session) {
    return
  }

  const verified = server.auth.verifyAuthState(
    server.client,
    ctx,
    session.authState
  )

  if (verified === true) {
    sendAuthMessage(ctx, true)
    return
  }

  session.authState = verified

  sendAuthMessage(ctx, verified)
}
