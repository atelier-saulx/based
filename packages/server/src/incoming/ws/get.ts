import {
  decodePayload,
  decodeName,
  readUint8,
  encodeGetResponse,
} from '../../protocol'
import { BasedServer } from '../../server'
import {
  createObs,
  destroyObs,
  subscribeNext,
  verifyRoute,
  getObs,
  hasObs,
  sendObsWs,
  ActiveObservable,
  sendObsGetError,
} from '../../observable'
import { BasedFunctionRoute } from '../../functions'
import { WebSocketSession, Context } from '../../context'
import { BasedErrorCode } from '../../error'
import { sendError } from '../../sendError'
import { rateLimitRequest } from '../../security'

const sendGetData = (
  server: BasedServer,
  id: number,
  obs: ActiveObservable,
  checksum: number,
  ctx: Context<WebSocketSession>
) => {
  if (!ctx.session) {
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
  checksum: number,
  name: string
) => {
  const obs = getObs(server, id)
  if (obs.error) {
    sendObsGetError(server, ctx, id, name, obs.error)
    return
  }
  if (obs.cache) {
    sendGetData(server, id, obs, checksum, ctx)
    return
  }
  subscribeNext(obs, (err) => {
    if (err) {
      sendObsGetError(server, ctx, id, name, err)
    } else {
      sendGetData(server, id, obs, checksum, ctx)
    }
  })
}

const install = (
  server: BasedServer,
  name: string,
  ctx: Context<WebSocketSession>,
  route: BasedFunctionRoute,
  id: number,
  checksum: number,
  payload: any
) => {
  server.functions
    .install(name)
    .then((spec) => {
      if (!ctx.session) {
        return
      }
      if (!verifyRoute(server, name, spec, ctx)) {
        return
      }
      if (hasObs(server, id)) {
        getFromExisting(server, id, ctx, checksum, name)
        return
      }
      const obs = createObs(server, name, id, payload)
      if (!ctx.session?.obs.has(id)) {
        subscribeNext(obs, (err) => {
          if (err) {
            sendObsGetError(server, ctx, id, name, err)
          } else {
            sendGetData(server, id, obs, checksum, ctx)
          }
        })
      }
    })
    .catch(() => {
      sendError(server, ctx, BasedErrorCode.FunctionNotFound, route)
    })
}

export const getMessage = (
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

  const payload = decodePayload(
    new Uint8Array(arr.slice(start + 21 + nameLen, start + len)),
    isDeflate
  )

  if (route.public === true) {
    if (hasObs(server, id)) {
      getFromExisting(server, id, ctx, checksum, name)
      return
    }
    install(server, name, ctx, route, id, checksum, payload)
    return true
  }

  server.auth
    .authorize(server, ctx, name, payload)
    .then((ok) => {
      if (!ctx.session) {
        return false
      }
      if (!ok) {
        sendError(server, ctx, BasedErrorCode.AuthorizeRejectedError, {
          route,
          observableId: id,
        })
        return false
      }
      if (hasObs(server, id)) {
        getFromExisting(server, id, ctx, checksum, name)
        return
      }
      install(server, name, ctx, route, id, checksum, payload)
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
