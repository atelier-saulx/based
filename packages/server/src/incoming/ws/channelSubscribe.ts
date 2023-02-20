import {
  readUint8,
  decodeName,
  decodePayload,
  parsePayload,
} from '../../protocol'
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
  getChannel,
  destroyChannel,
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
    if (spec === null || !ctx.session.obs.has(id)) {
      return
    }
    if (!hasChannel(server, id)) {
      createChannel(server, route.name, id, payload)
    }
    ctx.session.subscribe(String(id))
    subscribeChannel(server, id, ctx)
  })
}

const isNotAuthorized: AuthErrorHandler<
  WebSocketSession,
  BasedChannelFunctionRoute
> = (route, server, ctx, payload, id) => {
  if (!ctx.session.unauthorizedChannels) {
    ctx.session.unauthorizedChannels = new Set()
  }
  ctx.session.unauthorizedChannels.add({
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

  if (isChannelIdRequester) {
    console.info('ONLY FOR PUBLISH isChannelIdRequester')
    // just make a map for the id and thats it!
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
    rateLimitRequest(server, ctx, route.rateLimitTokens, server.rateLimit.ws)
  ) {
    ctx.session.close()
    return false
  }

  if (len > route.maxPayloadSize) {
    // sendError(server, ctx, BasedErrorCode.PayloadTooLarge, {
    //   route,
    //   requestId,
    // })
    return true
  }

  if (isChannelIdRequester) {
    if (
      rateLimitRequest(
        server,
        ctx,
        // Higher amount of rate limit because you are gaming the system if this happens
        route.rateLimitTokens * 5,
        server.rateLimit.ws
      )
    ) {
      ctx.session.close()
      return false
    }

    // TODO: may need to add authorization here....
    if (!hasChannel(server, id)) {
      // This has to be done instant
      createChannel(server, name, id, true)
      installFn(server, ctx, route, id).then((spec) => {
        if (spec === null) {
          server.activeChannels[name].delete(id)
          delete server.activeChannels[name]
          server.activeChannelsById.delete(id)
          return
        }
        destroyChannel(server, id)
      })
    } else {
      getChannel(server, id)
      destroyChannel(server, id)
    }
    return true
  }

  if (ctx.session?.obs.has(id)) {
    // Allready subscribed to this id
    return true
  }

  const payload = parsePayload(
    decodePayload(
      new Uint8Array(arr.slice(start + 13 + nameLen, start + len)),
      false
    )
  )

  ctx.session.obs.add(id)

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
    ctx.session.unsubscribe(String(id))
  }

  return true
}
