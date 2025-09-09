import { decodePayload, decodeName, encodeGetResponse } from '../../protocol.js'
import { BasedServer } from '../../server.js'
import {
  createObs,
  destroyObs,
  subscribeNext,
  getObsAndStopRemove,
  hasObs,
  start,
  sendObsWs,
  ActiveObservable,
  sendObsGetError,
  AttachedCtx,
  createObsNoStart,
} from '../../query/index.js'
import { WebSocketSession, Context, BasedRoute } from '@based/functions'
import { BasedErrorCode } from '@based/errors'
import { sendError } from '../../sendError.js'
import { rateLimitRequest } from '../../security.js'
import { verifyRoute } from '../../verifyRoute.js'
import { authorize } from '../../authorize.js'
import { BinaryMessageHandler } from './types.js'
import { readUint64 } from '@based/utils'
import { attachCtx } from '../../query/attachCtx.js'
import { FunctionErrorHandler, FunctionHandler } from '../../types.js'

const sendGetData = (
  server: BasedServer,
  id: number,
  obs: ActiveObservable,
  checksum: number,
  ctx: Context<WebSocketSession>,
) => {
  if (!ctx.session) {
    destroyObs(server, id)
    return
  }
  if (checksum === 0) {
    sendObsWs(ctx, obs.cache, obs, false)
  } else if (checksum === obs.checksum) {
    ctx.session.ws.send(encodeGetResponse(id), true, false)
  } else if (obs.diffCache && obs.previousChecksum === checksum) {
    sendObsWs(ctx, obs.diffCache, obs, true)
  } else {
    sendObsWs(ctx, obs.cache, obs, false)
  }
  destroyObs(server, id)
}

const getFromExisting = (
  server: BasedServer,
  id: number,
  ctx: Context<WebSocketSession>,
  checksum: number,
) => {
  const obs = getObsAndStopRemove(server, id)

  if (server.queryEvents) {
    server.queryEvents.get(obs, ctx)
  }

  if (obs.error) {
    sendObsGetError(server, ctx, id, obs.error)
    return
  }
  if (obs.cache) {
    sendGetData(server, id, obs, checksum, ctx)
    return
  }
  subscribeNext(obs, (err) => {
    if (err) {
      sendObsGetError(server, ctx, id, err)
    } else {
      sendGetData(server, id, obs, checksum, ctx)
    }
  })
}

const isAuthorized: FunctionHandler<WebSocketSession, BasedRoute<'query'>> = (
  props,
  spec,
) => {
  if (hasObs(props.server, props.id)) {
    getFromExisting(props.server, props.id, props.ctx, props.checksum)
    return
  }
  const session = props.ctx.session
  if (!session) {
    return
  }
  if (hasObs(props.server, props.id)) {
    getFromExisting(props.server, props.id, props.ctx, props.checksum)
    return
  }
  const obs = createObsNoStart(props, spec)
  if (props.server.queryEvents) {
    props.server.queryEvents.get(obs, props.ctx)
  }
  if (!session.obs.has(props.id)) {
    subscribeNext(obs, (err) => {
      if (err) {
        sendObsGetError(props.server, props.ctx, props.id, err)
      } else {
        sendGetData(props.server, props.id, obs, props.checksum, props.ctx)
      }
    })
  }
  start(props.server, props.id)
}

const isNotAuthorized: FunctionErrorHandler<
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

export const getMessage: BinaryMessageHandler = (
  arr,
  start,
  len,
  isDeflate,
  ctx,
  server,
) => {
  // | 4 header | 8 id | 8 checksum | 1 name length | * name | * payload |
  const nameLen = arr[start + 20]
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

  let attachedCtx: AttachedCtx
  if (route.ctx) {
    attachedCtx = attachCtx(route.ctx, ctx, id)
    id = attachedCtx.id
  }

  const payload =
    len === nameLen + 21
      ? undefined
      : decodePayload(
          new Uint8Array(arr.slice(start + 21 + nameLen, start + len)),
          isDeflate,
          ctx.session.v < 2,
        )

  authorize({
    route,
    server,
    ctx,
    payload,
    id,
    checksum,
    attachedCtx,
    next: isAuthorized,
    error: isNotAuthorized,
  })

  return true
}
