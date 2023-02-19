import { readUint8, decodePayload, parsePayload } from '../../protocol'
import { rateLimitRequest } from '../../security'
import { verifyRoute } from '../../verifyRoute'
import { installFn } from '../../installFn'
import { BinaryMessageHandler } from './types'

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

  if (!server.activeChannelsById.has(id)) {
    console.info('CANNOT find channel id fix fix fix')
    return true
  }

  const channel = server.activeChannelsById.get(id)

  console.info('  --> ', channel.name, channel.payload)

  const name = channel.name

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
    // TODO: emit error
    return true
  }

  const payload = parsePayload(
    decodePayload(new Uint8Array(arr.slice(start + 12, start + len)), isDeflate)
  )

  server.auth
    .authorize(server.client, ctx, route.name, payload)
    .then((ok) => {
      if (!ctx.session || !ok) {
        return
      }
      return installFn(server, ctx, route)
    })
    .then((spec) => {
      if (spec) {
        spec.publish(server.client, channel.payload, payload, channel.id, ctx)
      }
    })
    .catch(() => {})

  return true
}
