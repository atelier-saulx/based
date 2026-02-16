import {
  decodePayload,
  decodeName,
  encodeGetResponse,
  parseIncomingQueryPayload,
} from '../../protocol.js'
import { BasedServer } from '../../server.js'
import {
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
  returnId: number,
) => {
  const obs = getObsAndStopRemove(server, id)

  if (server.queryEvents) {
    server.queryEvents.get(obs, ctx)
  }

  if (obs.error) {
    sendObsGetError(server, ctx, returnId, obs.error)
    return
  }
  if (obs.cache) {
    sendGetData(server, returnId, obs, checksum, ctx)
    return
  }
  subscribeNext(obs, (err) => {
    if (err) {
      sendObsGetError(server, ctx, returnId, err)
    } else {
      sendGetData(server, returnId, obs, checksum, ctx)
    }
  })
}

const get: FunctionHandler<WebSocketSession, BasedRoute<'query'>> = (props) => {
  const returnId = props.attachedCtx ? props.attachedCtx.fromId : props.id

  if (hasObs(props.server, props.id)) {
    getFromExisting(props.server, props.id, props.ctx, props.checksum, returnId)
    return
  }
  const session = props.ctx.session
  if (!session) {
    return
  }
  if (hasObs(props.server, props.id)) {
    getFromExisting(props.server, props.id, props.ctx, props.checksum, returnId)
    return
  }
  const obs = createObsNoStart(props)
  if (props.server.queryEvents) {
    props.server.queryEvents.get(obs, props.ctx)
  }
  if (!session.obs.has(props.id)) {
    subscribeNext(obs, (err) => {
      if (err) {
        sendObsGetError(props.server, props.ctx, returnId, err)
      } else {
        sendGetData(props.server, returnId, obs, props.checksum, props.ctx)
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

  const payload = parseIncomingQueryPayload(
    arr,
    start,
    nameLen + 21,
    len,
    ctx.session,
    isDeflate,
  )

  if (route.ctx) {
    const attachedCtx = attachCtx(server, route, ctx, id)
    console.log('DERP DERP', id, attachedCtx.id)
    authorize({
      route,
      server,
      ctx,
      payload,
      id: attachedCtx.id,
      checksum,
      error: isNotAuthorized,
      attachedCtx,
    }).then(get)
  } else {
    authorize({
      route,
      server,
      ctx,
      payload,
      id,
      checksum,
      error: isNotAuthorized,
    }).then(get)
  }

  return true
}
