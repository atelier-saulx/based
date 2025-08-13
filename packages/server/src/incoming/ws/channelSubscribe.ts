import { decodeName, decodePayload } from '../../protocol.js'
import { BasedErrorCode } from '@based/errors'
import { sendError } from '../../sendError.js'
import { WebSocketSession, BasedRoute } from '@based/functions'
import { rateLimitRequest } from '../../security.js'
import { verifyRoute } from '../../verifyRoute.js'
import { installFn } from '../../installFn.js'
import {
  authorize,
  IsAuthorizedHandler,
  AuthErrorHandler,
} from '../../authorize.js'
import { BinaryMessageHandler } from './types.js'
import {
  hasChannel,
  subscribeChannel,
  createChannel,
  unsubscribeChannel,
  destroyChannel,
  extendChannel,
} from '../../channel/index.js'
import { readUint64 } from '@based/utils'

export const enableChannelSubscribe: IsAuthorizedHandler<
  WebSocketSession,
  BasedRoute<'channel'>
> = (route, _spec, server, ctx, payload, id) => {
  if (hasChannel(server, id)) {
    subscribeChannel(server, id, ctx)
    return
  }
  const session = ctx.session
  if (!session || !session.obs.has(id)) {
    return
  }
  if (!hasChannel(server, id)) {
    createChannel(server, route.name, id, payload, true)
  }
  subscribeChannel(server, id, ctx)
}

const isNotAuthorized: AuthErrorHandler<
  WebSocketSession,
  BasedRoute<'channel'>
> = (route, _server, ctx, payload, id) => {
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
  server,
) => {
  // | 4 header | 8 id | 1 name length | * name | * payload |

  const nameLen = arr[start + 12]
  const id = readUint64(arr, start + 4)
  const name = decodeName(arr, start + 13, start + 13 + nameLen)

  if (!name || !id) {
    return false
  }

  const route = verifyRoute(
    server,
    ctx,
    'channel',
    server.functions.route(name),
    name,
    id,
  )

  const tmpRoute: BasedRoute<'channel'> = route || {
    rateLimitTokens: 10,
    maxPayloadSize: 500,
    name,
    type: 'channel',
  }

  if (
    rateLimitRequest(
      server,
      ctx,
      // Requesting the id multiple times is something that should not happen - so probably a bad actor
      isChannelIdRequester
        ? tmpRoute.rateLimitTokens * 5
        : tmpRoute.rateLimitTokens,
      server.rateLimit.ws,
    )
  ) {
    return false
  }

  if (isChannelIdRequester) {
    if (len > tmpRoute.maxPayloadSize * 100) {
      // if size is crazy large then do this must be a mallcontent
      ctx.session.ws.close()
      return false
    }
    // TODO: Add authorization here....
    if (!hasChannel(server, id)) {
      const payload =
        len === nameLen + 13
          ? undefined
          : decodePayload(
              new Uint8Array(arr.slice(start + 13 + nameLen, start + len)),
              false,
              ctx.session.v < 2,
            )

      // This has to be done instantly so publish can be received immediatly
      const channel = createChannel(server, name, id, payload, true)

      installFn(server, ctx, tmpRoute, id).then((spec) => {
        if (spec === null) {
          channel.doesNotExist = true
        } else {
          channel.doesNotExist = false
        }
        destroyChannel(server, id)
      })
      return true
    }

    extendChannel(server, server.activeChannelsById.get(id))
    return true
  }

  // // TODO: add strictness setting - if strict return false here
  if (route === null) {
    return true
  }

  if (len > tmpRoute.maxPayloadSize) {
    sendError(server, ctx, BasedErrorCode.PayloadTooLarge, {
      route: tmpRoute,
      channelId: id,
    })
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
      : decodePayload(
          new Uint8Array(arr.slice(start + 13 + nameLen, start + len)),
          false,
          ctx.session.v < 2,
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
    false,
    isNotAuthorized,
  )

  return true
}

export const unsubscribeChannelMessage: BinaryMessageHandler = (
  arr,
  start,
  _len,
  _isDeflate,
  ctx,
  server,
) => {
  // | 4 header | 1 subType | 8 id |
  if (!ctx.session) {
    return false
  }

  const id = readUint64(arr, start + 5)

  if (!id) {
    return false
  }

  if (unsubscribeChannel(server, id, ctx)) {
    ctx.session.ws.unsubscribe(String(id))
  }

  return true
}
