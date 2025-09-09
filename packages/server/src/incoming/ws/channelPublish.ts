import { decodePayload } from '../../protocol.js'
import { rateLimitRequest } from '../../security.js'
import { verifyRoute } from '../../verifyRoute.js'
import { BinaryMessageHandler } from './types.js'
import { extendChannel, hasChannel } from '../../channel/index.js'
import { authorize } from '../../authorize.js'
import { WebSocketSession, BasedRoute } from '@based/functions'
import { sendError } from '../../sendError.js'
import { BasedErrorCode } from '@based/errors'
import { readUint64 } from '@based/utils'
import { FunctionHandler } from '../../types.js'

const publish: FunctionHandler<WebSocketSession, BasedRoute<'channel'>> = (
  props,
) => {
  const channel = props.server.activeChannelsById.get(props.id)
  if (!channel) {
    return
  }
  try {
    if (props.spec.relay) {
      const client = props.server.clients[props.spec.relay.client]
      client.channel(channel.name, channel.payload).publish(props.payload)
    } else {
      props.spec.publisher(
        props.server.client,
        channel.payload,
        props.payload,
        channel.id,
        props.ctx,
      )
    }
  } catch (err) {
    sendError(props.server, props.ctx, BasedErrorCode.FunctionError, {
      channelId: props.id,
      err,
      route: props.route,
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
      : decodePayload(
          new Uint8Array(arr.slice(start + 12, start + len)),
          isDeflate,
          ctx.session.v < 2,
        )

  authorize({ route, server, ctx, payload, id }, route.publicPublisher).then(
    publish,
  )

  return true
}
