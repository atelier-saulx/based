import { readUint8, decodePayload, parsePayload } from '../../protocol'
import { rateLimitRequest } from '../../security'
import { verifyRoute } from '../../verifyRoute'
import { installFn } from '../../installFn'
import { BinaryMessageHandler } from './types'
import { extendChannel, hasChannel } from '../../channel'
import { IsAuthorizedHandler, authorize } from '../../authorize'
import { WebSocketSession } from '@based/functions'
import { BasedChannelFunctionRoute } from '../../functions'
import { sendError } from '../../sendError'
import { BasedErrorCode } from '../../error'

const publish: IsAuthorizedHandler<
  WebSocketSession,
  BasedChannelFunctionRoute
> = (route, server, ctx, payload, id) => {
  installFn(server, ctx, route).then((spec) => {
    if (spec === null) {
      return
    }
    const channel = server.activeChannelsById.get(id)
    if (!channel) {
      return
    }
    try {
      spec.publish(server.client, channel.payload, payload, channel.id, ctx)
    } catch (err) {
      sendError(server, ctx, BasedErrorCode.FunctionError, {
        channelId: id,
        err,
        route,
      })
    }
  })
}

export const channelPublishMessage: BinaryMessageHandler = (
  arr,
  start,
  len,
  isDeflate,
  ctx,
  server
) => {
  // | 4 header | 8 id | * payload |
  const id = readUint8(arr, start + 4, 8)

  // how to determine it does not exist?
  if (!hasChannel(server, id)) {
    if (rateLimitRequest(server, ctx, 1, server.rateLimit.ws)) {
      ctx.session.ws.close()
      return false
    }
    ctx.session.ws.send(arr.slice(start, start + len), true, false)
    return true
  }

  const channel = server.activeChannelsById.get(id)
  extendChannel(server, channel)

  const name = channel.name

  const route = verifyRoute(
    server,
    ctx,
    'channel',
    server.functions.route(name),
    name
  )

  if (route === null) {
    return true
  }

  if (
    rateLimitRequest(server, ctx, route.rateLimitTokens, server.rateLimit.ws)
  ) {
    ctx.session.ws.close()
    return false
  }

  if (len > route.maxPayloadSize) {
    return true
  }

  const payload =
    len === 12
      ? undefined
      : parsePayload(
          decodePayload(
            new Uint8Array(arr.slice(start + 12, start + len)),
            isDeflate
          )
        )

  if (route.public || route.publisher?.public) {
    installFn(server, ctx, route)
      .then((spec) => {
        spec?.publish(server.client, channel.payload, payload, channel.id, ctx)
      })
      .catch(() => {})
    return true
  }

  authorize(route, server, ctx, payload, publish, id)

  return true
}
