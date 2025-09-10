import {
  valueToBuffer,
  decodePayload,
  encodeAuthResponse,
  valueToBufferV1,
} from '../../protocol.js'
import { BasedServer } from '../../server.js'
import { enableSubscribe, queryIsNotAuthorized } from './query.js'
import { rateLimitRequest } from '../../security.js'
import { AuthState, WebSocketSession, Context } from '@based/functions'
import { BinaryMessageHandler } from './types.js'
import { enableChannelSubscribe } from './channelSubscribe.js'
import { authorize } from '../../authorize.js'
import { unsubscribeWs } from '../../query/unsub.js'
import { attachCtx } from '../../query/attachCtx.js'
import { AttachedCtx } from '../../query/types.js'

const sendAuthMessage = (ctx: Context<WebSocketSession>, payload: any) => {
  ctx.session?.ws.send(
    encodeAuthResponse(
      ctx.session.v < 2
        ? valueToBufferV1(payload, true)
        : valueToBuffer(payload, true),
    ),
    true,
    false,
  )
}

const parse = (payload: AuthState) => {
  if (typeof payload !== 'object') {
    return { error: 'invalid token' }
  }
  return payload
}

export const reEvaulateUnauthorized = (
  server: BasedServer,
  ctx: Context<WebSocketSession>,
) => {
  const session = ctx.session
  if (!session) {
    return
  }

  if (session.attachedCtxObs?.size) {
    session.attachedCtxObs.forEach((id) => {
      const obs = server.activeObservablesById.get(id)
      if (obs.attachedCtx.authState) {
        const prevAttachedCtx = obs.attachedCtx
        const attachedCtx = attachCtx(
          prevAttachedCtx.config,
          ctx,
          prevAttachedCtx.fromId,
        )
        if (attachedCtx.id !== id) {
          unsubscribeWs(server, prevAttachedCtx.fromId, ctx)
          id = attachedCtx.id
          // This is for async unsubscribe (auth / install not rdy before unsub command)
          session.obs.add(id)
          authorize({
            route: obs.route,
            server,
            ctx,
            payload: obs.payload,
            id,
            checksum: obs.checksum,
            attachedCtx,
            error: () => {
              console.log('ERROR')
              // prob do nothing!
            },
          }).then(enableSubscribe)
        }
      }
    })
  }

  if (session.unauthorizedObs?.size) {
    session.unauthorizedObs.forEach((obs) => {
      let { id, route, checksum, payload } = obs
      let attachedCtx: AttachedCtx
      if (route.ctx) {
        attachedCtx = attachCtx(route.ctx, ctx, id)
        ctx.session.obs.delete(id)
        id = attachedCtx.id
        ctx.session.obs.add(id)
      }
      console.log('derp ---->', attachedCtx, ctx.session)
      authorize({
        route,
        server,
        ctx,
        payload,
        id,
        attachedCtx,
        checksum,
        error: () => {
          console.log('ERROR')
          // prob do nothing!
        },
      }).then((props) => {
        session.unauthorizedObs.delete(obs)
        enableSubscribe(props)
      })
    })
  }
  if (session.unauthorizedChannels?.size) {
    session.unauthorizedChannels.forEach((channel) => {
      const { id, route, payload } = channel
      authorize({
        route,
        server,
        ctx,
        id,
        payload,
      }).then((props) => {
        session.unauthorizedChannels.delete(channel)
        enableChannelSubscribe(props)
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
  server,
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
    isDeflate,
    ctx.session.v < 2,
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

      // Make re-eval always here for ATTACH CTX

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
  ctx: Context<WebSocketSession>,
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
