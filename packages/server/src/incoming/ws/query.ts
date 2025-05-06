import { decodePayload, decodeName } from '../../protocol.js'
import {
  createObs,
  unsubscribeWs,
  subscribeWs,
  hasObs,
} from '../../query/index.js'
import { BasedErrorCode } from '@based/errors'
import { WebSocketSession, BasedRoute } from '@based/functions'
import { sendError } from '../../sendError.js'
import { rateLimitRequest } from '../../security.js'
import { verifyRoute } from '../../verifyRoute.js'
import {
  authorize,
  IsAuthorizedHandler,
  AuthErrorHandler,
} from '../../authorize.js'
import { BinaryMessageHandler } from './types.js'
import { readUint64 } from '@saulx/utils'

export const enableSubscribe: IsAuthorizedHandler<
  WebSocketSession,
  BasedRoute<'query'>
> = (route, _spec, server, ctx, payload, id, checksum) => {
  if (hasObs(server, id)) {
    subscribeWs(server, id, checksum, ctx)
    return
  }
  const session = ctx.session
  if (!session.obs.has(id)) {
    return
  }
  if (!hasObs(server, id)) {
    createObs(server, route.name, id, payload)
  }
  subscribeWs(server, id, checksum, ctx)
}

const isNotAuthorized: AuthErrorHandler<
  WebSocketSession,
  BasedRoute<'query'>
> = (route, _server, ctx, payload, id, checksum) => {
  const session = ctx.session
  if (!session.unauthorizedObs) {
    session.unauthorizedObs = new Set()
  }
  session.unauthorizedObs.add({
    id,
    checksum,
    name: route.name,
    payload,
  })
}

export const subscribeMessage: BinaryMessageHandler = (
  arr,
  start,
  len,
  isDeflate,
  ctx,
  server,
) => {
  // | 4 header | 8 id | 8 checksum | 1 name length | * name | * payload |

  const nameLen = arr[start + 20]
  const id = readUint64(arr, start + 4)
  const checksum = readUint64(arr, start + 12)
  const name = decodeName(arr, start + 21, start + 21 + nameLen)

  if (!name || !id) {
    return false
  }

  const route = verifyRoute(
    server,
    ctx,
    'query',
    server.functions.route(name),
    name,
    id,
  )

  // TODO: add strictness setting - if strict return false here
  if (route === null) {
    return true
  }

  if (
    rateLimitRequest(server, ctx, route.rateLimitTokens, server.rateLimit.ws)
  ) {
    ctx.session.ws.close()
    return false
  }

  if (route.maxPayloadSize !== -1 && len > route.maxPayloadSize) {
    sendError(server, ctx, BasedErrorCode.PayloadTooLarge, {
      route,
      observableId: id,
    })
    return true
  }

  const session = ctx.session

  if (session.obs.has(id)) {
    // Allready subscribed to this id
    return true
  }

  const payload =
    len === nameLen + 21
      ? undefined
      : decodePayload(
          new Uint8Array(arr.slice(start + 21 + nameLen, start + len)),
          isDeflate,
          ctx.session.v < 2,
        )

  session.obs.add(id)

  authorize(
    route,
    server,
    ctx,
    payload,
    enableSubscribe,
    id,
    checksum,
    false,
    isNotAuthorized,
  )

  return true
}

export const unsubscribeMessage: BinaryMessageHandler = (
  arr,
  start,
  _len,
  _isDeflate,
  ctx,
  server,
) => {
  // | 4 header | 8 id |
  if (!ctx.session) {
    return false
  }

  const id = readUint64(arr, start + 4)

  if (!id) {
    return false
  }

  if (unsubscribeWs(server, id, ctx)) {
    ctx.session.ws.unsubscribe(String(id))
  }

  return true
}
