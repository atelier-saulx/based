import {
  decodePayload,
  decodeName,
  readUint8,
  encodeGetResponse,
} from '../../../protocol'
import { BasedServer } from '../../server'
import {
  createObs,
  destroyObs,
  subscribeNext,
  verifyRoute,
  getObs,
  hasObs,
  sendObsWs,
  sendObsGetError,
} from '../../observable'
import {
  ActiveObservable,
  BasedFunctionRoute,
  WebsocketClient,
} from '../../../types'
import { BasedErrorCode } from '../../../error'
import { sendError } from '../../sendError'

const sendGetData = (
  server: BasedServer,
  id: number,
  obs: ActiveObservable,
  checksum: number,
  client: WebsocketClient
) => {
  if (!client.ws) {
    return
  }
  if (checksum === 0) {
    sendObsWs(client, obs.cache, obs)
  } else if (checksum === obs.checksum) {
    client.ws.send(encodeGetResponse(id), true, false)
  } else if (obs.diffCache && obs.previousChecksum === checksum) {
    sendObsWs(client, obs.diffCache, obs)
  } else {
    sendObsWs(client, obs.cache, obs)
  }
  destroyObs(server, id)
}

const getFromExisting = (
  server: BasedServer,
  id: number,
  client: WebsocketClient,
  checksum: number,
  name: string
) => {
  const obs = getObs(server, id)
  if (obs.error) {
    sendObsGetError(server, client, id, name, obs.error)
    return
  }
  if (obs.cache) {
    sendGetData(server, id, obs, checksum, client)
    return
  }
  subscribeNext(obs, (err) => {
    if (err) {
      sendObsGetError(server, client, id, name, err)
    } else {
      sendGetData(server, id, obs, checksum, client)
    }
  })
}

const install = (
  server: BasedServer,
  name: string,
  client: WebsocketClient,
  route: BasedFunctionRoute,
  id: number,
  checksum: number,
  payload: any
) => {
  server.functions
    .install(name)
    .then((spec) => {
      if (!verifyRoute(server, name, spec, client)) {
        return
      }

      if (hasObs(server, id)) {
        getFromExisting(server, id, client, checksum, name)
        return
      }
      const obs = createObs(server, name, id, payload)

      if (!client.ws?.obs.has(id)) {
        subscribeNext(obs, (err) => {
          if (err) {
            sendObsGetError(server, client, id, name, err)
          } else {
            sendGetData(server, id, obs, checksum, client)
          }
        })
      }
    })
    .catch(() => {
      sendError(server, client, BasedErrorCode.FunctionNotFound, route)
    })
}

export const getMessage = (
  arr: Uint8Array,
  start: number,
  len: number,
  isDeflate: boolean,
  client: WebsocketClient,
  server: BasedServer
) => {
  // | 4 header | 8 id | 8 checksum | 1 name length | * name | * payload |
  const nameLen = arr[start + 20]
  const id = readUint8(arr, start + 4, 8)
  const checksum = readUint8(arr, start + 12, 8)
  const name = decodeName(arr, start + 21, start + 21 + nameLen)

  if (!name || !id) {
    // TODO: sendError(server, client, BasedErrorCode.AuthorizeRejectedError, route)
    return false
  }

  const route = verifyRoute(server, name, server.functions.route(name), client)

  if (!route) {
    return false
  }

  if (route.maxPayloadSize !== -1 && len > route.maxPayloadSize) {
    sendError(server, client, BasedErrorCode.PayloadTooLarge, route)
    return false
  }

  const payload = decodePayload(
    new Uint8Array(arr.slice(start + 21 + nameLen, start + len)),
    isDeflate
  )

  server.auth
    .authorize(client.ws, name, payload)
    .then((ok) => {
      if (!client.ws) {
        return false
      }

      if (!ok) {
        sendError(server, client, BasedErrorCode.AuthorizeRejectedError, route)
        return false
      }

      if (hasObs(server, id)) {
        getFromExisting(server, id, client, checksum, name)
        return
      }

      install(server, name, client, route, id, checksum, payload)
    })
    .catch((err) => {
      sendError(server, client, BasedErrorCode.AuthorizeFunctionError, {
        route,
        observableId: id,
        err,
      })
    })

  return true
}
