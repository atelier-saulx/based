import { decodePayload, decodeName, readUint8 } from '../../protocol'
import { BasedServer } from '../../server'
import {
  createObs,
  unsubscribeWs,
  destroyObs,
  subscribeWs,
  verifyRoute,
  hasObs,
} from '../../observable'
import { BasedErrorCode } from '../../error'
import { WebsocketClient } from '../../client'
import { BasedFunctionRoute } from '../../functions'
import { sendError } from '../../sendError'

export const enableSubscribe = (
  server: BasedServer,
  client: WebsocketClient,
  id: number,
  checksum: number,
  name: string,
  payload: any,
  route: BasedFunctionRoute
) => {
  if (hasObs(server, id)) {
    subscribeWs(server, id, checksum, client)
    return
  }

  server.functions
    .install(name)
    .then((spec) => {
      if (!verifyRoute(server, name, spec, client)) {
        return
      }

      if (!client.ws?.obs.has(id)) {
        return
      }

      if (!hasObs(server, id)) {
        createObs(server, name, id, payload)
      }

      client.ws.subscribe(String(id))
      subscribeWs(server, id, checksum, client)
    })
    .catch(() => {
      sendError(server, client, BasedErrorCode.FunctionNotFound, route)
    })
}

export const subscribeMessage = (
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

  if (client.ws?.obs.has(id)) {
    // allready subscribed to this id
    return true
  }

  const payload = decodePayload(
    new Uint8Array(arr.slice(start + 21 + nameLen, start + len)),
    isDeflate
  )

  client.ws.obs.add(id)

  server.auth
    .authorize(client.ws, name, payload)
    .then((ok) => {
      if (!client.ws) {
        return
      }
      if (!client.ws.obs.has(id)) {
        return
      }
      if (!ok) {
        client.ws.unauthorizedObs.add({ id, checksum, name, payload })
        sendError(server, client, BasedErrorCode.AuthorizeRejectedError, {
          route,
          observableId: id,
        })
        return
      }
      enableSubscribe(server, client, id, checksum, name, payload, route)
    })
    .catch((err) => {
      sendError(server, client, BasedErrorCode.AuthorizeFunctionError, {
        route,
        observableId: id,
        err,
      })
      destroyObs(server, id)
    })

  return true
}

export const unsubscribeMessage = (
  arr: Uint8Array,
  start: number,
  client: WebsocketClient,
  server: BasedServer
) => {
  // | 4 header | 8 id |
  if (!client.ws) {
    return false
  }

  const id = readUint8(arr, start + 4, 8)

  if (!id) {
    return false
  }

  if (unsubscribeWs(server, id, client)) {
    client.ws.unsubscribe(String(id))
  }

  return true
}
