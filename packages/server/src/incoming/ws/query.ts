import { decodePayload, decodeName } from '../../protocol.js'
import {
  createObs,
  unsubscribeWs,
  subscribeWs,
  hasObs,
  AttachedCtx,
} from '../../query/index.js'
import { BasedErrorCode } from '@based/errors'
import { WebSocketSession, BasedRoute } from '@based/functions'
import { sendError } from '../../sendError.js'
import { rateLimitRequest } from '../../security.js'
import { verifyRoute } from '../../verifyRoute.js'
import { authorize } from '../../authorize.js'
import { BinaryMessageHandler } from './types.js'
import { readUint64 } from '@based/utils'
import { attachCtx } from '../../query/attachCtx.js'
import { FunctionErrorHandler, FunctionHandler } from '../../types.js'

export const enableSubscribe: FunctionHandler<
  WebSocketSession,
  BasedRoute<'query'>
> = (props) => {
  console.log('---> enableSub', props.id)
  if (hasObs(props.server, props.id)) {
    subscribeWs(props.server, props.id, props.checksum, props.ctx)
    return
  }
  const session = props.ctx.session
  if (!session.obs.has(props.id)) {
    return
  }
  if (!hasObs(props.server, props.id)) {
    const obs = createObs(props)
  }
  subscribeWs(props.server, props.id, props.checksum, props.ctx)
}

export const queryIsNotAuthorized: FunctionErrorHandler<
  WebSocketSession,
  BasedRoute<'query'>
> = (props) => {
  const session = props.ctx.session
  if (!session.unauthorizedObs) {
    session.unauthorizedObs = new Set()
  }
  session.unauthorizedObs.add({
    id: props.id,
    checksum: props.checksum,
    route: props.route,
    payload: props.payload,
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
  // get id maybe

  let id = readUint64(arr, start + 4)
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

  let attachedCtx: AttachedCtx

  if (route.ctx) {
    attachedCtx = attachCtx(route.ctx, ctx, id)
    id = attachedCtx.id
  }

  if (session.obs.has(id)) {
    // Allready subscribed to this id
    return true
  }

  let payload =
    len === nameLen + 21
      ? undefined
      : decodePayload(
          new Uint8Array(arr.slice(start + 21 + nameLen, start + len)),
          isDeflate,
          ctx.session.v < 2,
        )

  console.info(' ADD TO session obs', id)
  session.obs.add(id)

  authorize({
    route,
    server,
    ctx,
    payload,
    id,
    checksum,
    attachedCtx,
    error: queryIsNotAuthorized,
  }).then(enableSubscribe)

  return true
}

export const unsubscribeMessage: BinaryMessageHandler = (
  arr,
  start,
  len,
  isDeflate,
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
