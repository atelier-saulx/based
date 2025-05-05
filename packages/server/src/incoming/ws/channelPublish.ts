import { decodePayload, parsePayload } from '../../protocol.js'
import { rateLimitRequest } from '../../security.js'
import { verifyRoute } from '../../verifyRoute.js'
import { BinaryMessageHandler } from './types.js'
import { extendChannel, hasChannel } from '../../channel/index.js'
import { IsAuthorizedHandler, authorize } from '../../authorize.js'
import { WebSocketSession, BasedRoute } from '@based/functions'
import { sendError } from '../../sendError.js'
import { BasedErrorCode } from '@based/errors'
import { readUint64 } from '@saulx/utils'

const publish: IsAuthorizedHandler<WebSocketSession, BasedRoute<'channel'>> = (
  route,
  spec,
  server,
  ctx,
  payload,
  id,
) => {
  const channel = server.activeChannelsById.get(id)
  if (!channel) {
    return
  }

  try {
    if (spec.relay) {
      const client = server.clients[spec.relay.client]
      client.channel(channel.name, channel.payload).publish(payload)
    } else {
      spec.publisher(server.client, channel.payload, payload, channel.id, ctx)
    }
  } catch (err) {
    sendError(server, ctx, BasedErrorCode.FunctionError, {
      channelId: id,
      err,
      route,
    })
  }
}

export const channelPublishMessage: BinaryMessageHandler = (
  arr,
  start,
  len,
  isDeflate,
  ctx,
  server,
) => {
  // | 4 header | 8 id | * payload |
  const id = readUint64(arr, start + 4)

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
    name,
    id,
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
            isDeflate,
          ),
        )

  authorize(
    route,
    server,
    ctx,
    payload,
    publish,
    id,
    undefined,
    route.publicPublisher,
  )

  return true
}
