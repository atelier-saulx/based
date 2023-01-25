import { decodePayload, decodeName, readUint8 } from '../../protocol'
import { BasedServer } from '../../server'
import {
  createObs,
  unsubscribeWs,
  subscribeWs,
  verifyRoute,
  hasObs,
} from '../../observable'
import { BasedErrorCode } from '../../error'
import { WebSocketSession, Context } from '../../context'
import { BasedFunctionRoute } from '../../functions'
import { sendError } from '../../sendError'
import { rateLimitRequest } from '../../security'

export const enableSubscribe = (
  server: BasedServer,
  ctx: Context<WebSocketSession>,
  id: number,
  checksum: number,
  name: string,
  payload: any,
  route: BasedFunctionRoute
) => {
  if (hasObs(server, id)) {
    subscribeWs(server, id, checksum, ctx)
    return
  }

  server.functions
    .install(name)
    .then((spec) => {
      if (!verifyRoute(server, name, spec, ctx)) {
        return
      }
      if (!ctx.session?.obs.has(id)) {
        return
      }
      if (!hasObs(server, id)) {
        createObs(server, name, id, payload)
      }
      ctx.session.subscribe(String(id))
      subscribeWs(server, id, checksum, ctx)
    })
    .catch(() => {
      sendError(server, ctx, BasedErrorCode.FunctionNotFound, route)
    })
}

export const subscribeMessage = (
  arr: Uint8Array,
  start: number,
  len: number,
  isDeflate: boolean,
  ctx: Context<WebSocketSession>,
  server: BasedServer
) => {
  // | 4 header | 8 id | 8 checksum | 1 name length | * name | * payload |

  const nameLen = arr[start + 20]

  const id = readUint8(arr, start + 4, 8)
  const checksum = readUint8(arr, start + 12, 8)
  const name = decodeName(arr, start + 21, start + 21 + nameLen)

  if (!name || !id) {
    return false
  }

  const route = verifyRoute(server, name, server.functions.route(name), ctx)

  // TODO: add strictness setting - if strict return false here
  if (!route) {
    return true
  }

  if (
    rateLimitRequest(server, ctx, route.rateLimitTokens, server.rateLimit.ws)
  ) {
    ctx.session.close()
    return false
  }

  if (route.maxPayloadSize !== -1 && len > route.maxPayloadSize) {
    sendError(server, ctx, BasedErrorCode.PayloadTooLarge, route)
    return true
  }

  if (ctx.session?.obs.has(id)) {
    // allready subscribed to this id
    return true
  }

  const payload = decodePayload(
    new Uint8Array(arr.slice(start + 21 + nameLen, start + len)),
    isDeflate
  )

  ctx.session.obs.add(id)

  if (route.public === true) {
    enableSubscribe(server, ctx, id, checksum, name, payload, route)
    return true
  }

  server.auth
    .authorize(server, ctx, name, payload)
    .then((ok) => {
      if (!ctx.session?.obs.has(id)) {
        return
      }
      if (!ok) {
        ctx.session.unauthorizedObs.add({
          id,
          checksum,
          name,
          payload,
        })
        sendError(server, ctx, BasedErrorCode.AuthorizeRejectedError, {
          route,
          observableId: id,
        })
        return
      }
      enableSubscribe(server, ctx, id, checksum, name, payload, route)
    })
    .catch((err) => {
      sendError(server, ctx, BasedErrorCode.AuthorizeFunctionError, {
        route,
        observableId: id,
        err,
      })
    })

  return true
}

export const unsubscribeMessage = (
  arr: Uint8Array,
  start: number,
  ctx: Context<WebSocketSession>,
  server: BasedServer
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
