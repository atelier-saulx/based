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
} from '../../query/index.js'
import { WebSocketSession, Context, BasedRoute } from '@based/functions'
import { BasedErrorCode } from '@based/errors'
import { sendError } from '../../sendError.js'
import { rateLimitRequest } from '../../security.js'
import { verifyRoute } from '../../verifyRoute.js'
import {
  AuthErrorHandler,
  authorize,
  IsAuthorizedHandler,
} from '../../authorize.js'
import { BinaryMessageHandler } from './types.js'
import { readUint64 } from '@based/utils'
import { attachCtx } from '../../query/attachCtx.js'

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

const isAuthorized: IsAuthorizedHandler<
  WebSocketSession,
  BasedRoute<'query'>
> = (route, _spec, server, ctx, payload, id, checksum) => {
  if (hasObs(server, id)) {
    getFromExisting(server, id, ctx, checksum)
    return
  }
  const session = ctx.session
  if (!session) {
    return
  }
  if (hasObs(server, id)) {
    getFromExisting(server, id, ctx, checksum)
    return
  }
  const obs = createObs(server, route.name, id, payload, true)

  if (server.queryEvents) {
    server.queryEvents.get(obs, ctx)
  }

  if (!session.obs.has(id)) {
    subscribeNext(obs, (err) => {
      if (err) {
        sendObsGetError(server, ctx, id, err)
      } else {
        sendGetData(server, id, obs, checksum, ctx)
      }
    })
  }
  start(server, id)
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

  authorize(
    route,
    route.public,
    server,
    ctx,
    payload,
    isAuthorized,
    id,
    checksum,
    attachedCtx,
    isNotAuthorized,
  )

  return true
}
