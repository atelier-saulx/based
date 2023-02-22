import {
  readUint8,
  decodeName,
  decodePayload,
  parsePayload,
} from '../../protocol'
import { BasedErrorCode } from '../../error'
import { sendError } from '../../sendError'
import { BasedChannelFunctionRoute } from '../../functions'
import { WebSocketSession } from '@based/functions'
import { rateLimitRequest } from '../../security'
import { verifyRoute } from '../../verifyRoute'
import { installFn } from '../../installFn'
import {
  authorize,
  IsAuthorizedHandler,
  AuthErrorHandler,
} from '../../authorize'
import { BinaryMessageHandler } from './types'
import {
  hasChannel,
  subscribeChannel,
  createChannel,
  unsubscribeChannel,
  destroyChannel,
  extendChannel,
} from '../../channel'

export const enableChannelSubscribe: IsAuthorizedHandler<
  WebSocketSession,
  BasedChannelFunctionRoute
> = (route, server, ctx, payload, id) => {
  if (hasChannel(server, id)) {
    subscribeChannel(server, id, ctx)
    return
  }
  installFn(server, ctx, route, id).then((spec) => {
    const session = ctx.session
    if (spec === null || !session || !session.obs.has(id)) {
      return
    }
    if (!hasChannel(server, id)) {
      createChannel(server, route.name, id, payload)
    }
    ctx.session.ws.subscribe(String(id))
    subscribeChannel(server, id, ctx)
  })
}

const isNotAuthorized: AuthErrorHandler<
  WebSocketSession,
  BasedChannelFunctionRoute
> = (route, server, ctx, payload, id) => {
  const session = ctx.session
  if (!session.unauthorizedChannels) {
    session.unauthorizedChannels = new Set()
  }
  session.unauthorizedChannels.add({
    id,
    name: route.name,
    payload,
  })
}

export const channelSubscribeMessage: BinaryMessageHandler = (
  arr,
  start,
  len,
  // isDeflate is used differently here
  isChannelIdRequester,
  ctx,
  server
) => {
  // | 4 header | 8 id | 1 name length | * name | * payload |

  const nameLen = arr[start + 12]
  const id = readUint8(arr, start + 4, 8)
  const name = decodeName(arr, start + 13, start + 13 + nameLen)

  if (!name || !id) {
    return false
  }

  const route = verifyRoute(
    server,
    ctx,
    'channel',
    server.functions.route(name),
    name
  )

  // // TODO: add strictness setting - if strict return false here
  if (route === null) {
    return true
  }

  if (
    rateLimitRequest(
      server,
      ctx,
      // Requesting the id multiple times is something that should not happen - so probably a bad actor
      isChannelIdRequester ? route.rateLimitTokens * 5 : route.rateLimitTokens,
      server.rateLimit.ws
    )
  ) {
    ctx.session.ws.close()
    return false
  }

  if (len > route.maxPayloadSize) {
    sendError(server, ctx, BasedErrorCode.PayloadTooLarge, {
      route,
      channelId: id,
    })
    return true
  }

  if (isChannelIdRequester) {
    // TODO: Add authorization here....
    if (!hasChannel(server, id)) {
      const payload =
        len === nameLen + 13
          ? undefined
          : parsePayload(
              decodePayload(
                new Uint8Array(arr.slice(start + 13 + nameLen, start + len)),
                false
              )
            )
      // This has to be done instantly so publish can be received immediatly
      createChannel(server, name, id, payload, true)
      installFn(server, ctx, route, id).then((spec) => {
        if (spec === null) {
          server.activeChannels[name].delete(id)
          delete server.activeChannels[name]
          server.activeChannelsById.delete(id)
          return
        }
        destroyChannel(server, id)
      })
      return true
    }

    extendChannel(server, server.activeChannelsById.get(id))
    return true
  }

  const session = ctx.session

  if (session.obs.has(id)) {
    // Allready subscribed to this id
    return true
  }

  const payload =
    len === nameLen + 13
      ? undefined
      : parsePayload(
          decodePayload(
            new Uint8Array(arr.slice(start + 13 + nameLen, start + len)),
            false
          )
        )

  session.obs.add(id)

  authorize(
    route,
    server,
    ctx,
    payload,
    enableChannelSubscribe,
    id,
    0,
    isNotAuthorized
  )

  return true
}

export const unsubscribeChannelMessage: BinaryMessageHandler = (
  arr,
  start,
  len,
  isDeflate,
  ctx,
  server
) => {
  // | 4 header | 8 id |
  if (!ctx.session) {
    return false
  }

  const id = readUint8(arr, start + 4, 8)

  if (!id) {
    return false
  }

  if (unsubscribeChannel(server, id, ctx)) {
    ctx.session.ws.unsubscribe(String(id))
  }

  return true
}
