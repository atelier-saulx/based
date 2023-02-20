import {
  decodePayload,
  decodeName,
  readUint8,
  encodeGetResponse,
  parsePayload,
} from '../../protocol'
import { BasedServer } from '../../server'
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
} from '../../observable'
import { BasedQueryFunctionRoute } from '../../functions'
import { WebSocketSession, Context } from '@based/functions'
import { BasedErrorCode } from '../../error'
import { sendError } from '../../sendError'
import { rateLimitRequest } from '../../security'
import { verifyRoute } from '../../verifyRoute'
import {
  AuthErrorHandler,
  authorize,
  IsAuthorizedHandler,
} from '../../authorize'
import { installFn } from '../../installFn'
import { BinaryMessageHandler } from './types'

const sendGetData = (
  server: BasedServer,
  id: number,
  obs: ActiveObservable,
  checksum: number,
  ctx: Context<WebSocketSession>
) => {
  if (!ctx.session) {
    destroyObs(server, id)
    return
  }
  if (checksum === 0) {
    sendObsWs(ctx, obs.cache, obs)
  } else if (checksum === obs.checksum) {
    ctx.session.send(encodeGetResponse(id), true, false)
  } else if (obs.diffCache && obs.previousChecksum === checksum) {
    sendObsWs(ctx, obs.diffCache, obs)
  } else {
    sendObsWs(ctx, obs.cache, obs)
  }
  destroyObs(server, id)
}

const getFromExisting = (
  server: BasedServer,
  id: number,
  ctx: Context<WebSocketSession>,
  checksum: number
) => {
  const obs = getObsAndStopRemove(server, id)
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
  BasedQueryFunctionRoute
> = (route, server, ctx, payload, id, checksum) => {
  if (hasObs(server, id)) {
    getFromExisting(server, id, ctx, checksum)
    return
  }
  installFn(server, ctx, route, id).then((spec) => {
    if (spec === null) {
      return
    }
    const session = ctx.session?.getUserData()
    if (!session) {
      return
    }
    if (hasObs(server, id)) {
      getFromExisting(server, id, ctx, checksum)
      return
    }
    const obs = createObs(server, route.name, id, payload, true)
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
  })
}

const isNotAuthorized: AuthErrorHandler<
  WebSocketSession,
  BasedQueryFunctionRoute
> = (route, server, ctx, payload, id, checksum) => {
  const session = ctx.session?.getUserData()
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

  const payload = parsePayload(
    decodePayload(
      new Uint8Array(arr.slice(start + 21 + nameLen, start + len)),
      isDeflate
    )
  )

  authorize(
    route,
    server,
    ctx,
    payload,
    isAuthorized,
    id,
    checksum,
    isNotAuthorized
  )

  return true
}
