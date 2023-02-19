import {
  decodePayload,
  decodeName,
  readUint8,
  parsePayload,
} from '../../protocol'
import { createObs, unsubscribeWs, subscribeWs, hasObs } from '../../observable'
import { BasedErrorCode } from '../../error'
import { WebSocketSession } from '@based/functions'
import { BasedQueryFunctionRoute } from '../../functions'
import { sendError } from '../../sendError'
import { rateLimitRequest } from '../../security'
import { verifyRoute } from '../../verifyRoute'
import { installFn } from '../../installFn'
import {
  authorize,
  IsAuthorizedHandler,
  AuthErrorHandler,
} from '../../authorize'
import { BinaryMessageHandler } from './types'

export const enableSubscribe: IsAuthorizedHandler<
  WebSocketSession,
  BasedQueryFunctionRoute
> = (route, server, ctx, payload, id, checksum) => {
  if (hasObs(server, id)) {
    subscribeWs(server, id, checksum, ctx)
    return
  }
  installFn(server, ctx, route, id).then((spec) => {
    if (spec === null || !ctx.session.obs.has(id)) {
      return
    }
    if (!hasObs(server, id)) {
      createObs(server, route.name, id, payload)
    }
    ctx.session.subscribe(String(id))
    subscribeWs(server, id, checksum, ctx)
  })
}

const isNotAuthorized: AuthErrorHandler<
  WebSocketSession,
  BasedQueryFunctionRoute
> = (route, server, ctx, payload, id, checksum) => {
  if (!ctx.session.unauthorizedObs) {
    ctx.session.unauthorizedObs = new Set()
  }
  ctx.session.unauthorizedObs.add({
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
  server
) => {
  // | 4 header | 8 id | 8 checksum | 1 name length | * name | * payload |

  const nameLen = arr[start + 20]
  const id = readUint8(arr, start + 4, 8)
  const checksum = readUint8(arr, start + 12, 8)
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
    id
  )

  // TODO: add strictness setting - if strict return false here
  if (route === null) {
    return true
  }

  if (
    rateLimitRequest(server, ctx, route.rateLimitTokens, server.rateLimit.ws)
  ) {
    ctx.session.close()
    return false
  }

  if (route.maxPayloadSize !== -1 && len > route.maxPayloadSize) {
    sendError(server, ctx, BasedErrorCode.PayloadTooLarge, {
      route,
      observableId: id,
    })
    return true
  }

  if (ctx.session?.obs.has(id)) {
    // allready subscribed to this id
    return true
  }

  const payload = parsePayload(
    decodePayload(
      new Uint8Array(arr.slice(start + 21 + nameLen, start + len)),
      isDeflate
    )
  )

  ctx.session.obs.add(id)

  authorize(
    route,
    server,
    ctx,
    payload,
    enableSubscribe,
    id,
    checksum,
    isNotAuthorized
  )

  return true
}

export const unsubscribeMessage: BinaryMessageHandler = (
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

  if (unsubscribeWs(server, id, ctx)) {
    ctx.session.unsubscribe(String(id))
  }

  return true
}
