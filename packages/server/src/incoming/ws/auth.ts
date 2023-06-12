import {
  valueToBuffer,
  decodePayload,
  encodeAuthResponse,
} from '../../protocol'
import { BasedServer } from '../../server'
import { enableSubscribe } from './query'
import { rateLimitRequest } from '../../security'
import {
  AuthState,
  WebSocketSession,
  Context,
  BasedRoute,
} from '@based/functions'
import { BinaryMessageHandler } from './types'
import { enableChannelSubscribe } from './channelSubscribe'
import { installFn } from '../../installFn'
import { authorize } from '../../authorize'

const sendAuthMessage = (ctx: Context<WebSocketSession>, payload: any) =>
  ctx.session?.ws.send(encodeAuthResponse(valueToBuffer(payload)), true, false)

const parse = (payload: string) => {
  try {
    return JSON.parse(payload)
  } catch (err) {
    return { error: 'invalid token' }
  }
}

export const reEvaulateUnauthorized = (
  server: BasedServer,
  ctx: Context<WebSocketSession>
) => {
  const session = ctx.session
  if (!session) {
    return
  }
  if (session.unauthorizedObs?.size) {
    session.unauthorizedObs.forEach((obs) => {
      const { id, name, checksum, payload } = obs
      const route: BasedRoute<'query'> = {
        name,
        type: 'query',
      }
      installFn(server, ctx, route, id).then((spec) => {
        authorize(route, server, ctx, payload, () => {
          session.unauthorizedObs.delete(obs)
          if (spec) {
            enableSubscribe(route, spec, server, ctx, payload, id, checksum)
          }
        })
      })
    })
  }
  if (session.unauthorizedChannels?.size) {
    session.unauthorizedChannels.forEach((channel) => {
      const { id, name, payload } = channel
      const route: BasedRoute<'channel'> = {
        name,
        type: 'channel',
      }
      installFn(server, ctx, route, id).then((spec) => {
        authorize(route, server, ctx, payload, () => {
          session.unauthorizedChannels.delete(channel)
          if (spec) {
            enableChannelSubscribe(route, spec, server, ctx, payload, id)
          }
        })
      })
    })
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
    ctx.session.ws.close()
    return false
  }

  if (len > 20000) {
    return
  }

  // | 4 header | * payload |
  const payload = decodePayload(
    new Uint8Array(arr.slice(start + 4, start + len)),
    isDeflate
  )

  const authState: AuthState = parse(payload)

  server.auth
    .verifyAuthState(server.client, ctx, authState)
    .then((verified) => {
      const session = ctx.session
      if (!session) {
        return
      }

      session.authState = verified === true ? authState : verified

      if (verified !== true && verified.error) {
        sendAuthMessage(ctx, verified)
        return true
      }

      reEvaulateUnauthorized(server, ctx)

      sendAuthMessage(ctx, verified)
    })
    .catch((err) => {
      const session = ctx.session
      if (!session) {
        return
      }
      const authState = {
        error: err.message,
      }
      session.authState = authState
      sendAuthMessage(ctx, authState)
    })

  return true
}

// send and verify
export const sendAndVerifyAuthMessage = async (
  server: BasedServer,
  ctx: Context<WebSocketSession>
): Promise<void> => {
  const session = ctx.session
  if (!session) {
    return
  }
  const verified = await server.auth
    .verifyAuthState(server.client, ctx, session.authState)
    .catch((err) => {
      return { error: err.message }
    })
  if (verified === true) {
    sendAuthMessage(ctx, true)
    return
  }
  session.authState = verified
  sendAuthMessage(ctx, verified)
}
