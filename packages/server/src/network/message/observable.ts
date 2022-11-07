import { isObservableFunctionSpec } from '../../functions'
import { decodePayload, decodeName, readUint8 } from '../../protocol'
import { BasedServer } from '../../server'
import { create, unsubscribe, destroy, subscribe } from '../../observable'
import { BasedErrorCode } from '../../error'
import { sendError } from './send'
import { WebsocketClient, BasedFunctionRoute } from '../../types'

export const enableSubscribe = (
  server: BasedServer,
  client: WebsocketClient,
  id: number,
  checksum: number,
  name: string,
  payload: any,
  route: BasedFunctionRoute
) => {
  client.ws.subscribe(String(id))

  if (server.activeObservablesById.has(id)) {
    subscribe(server, id, checksum, client)
  } else {
    server.functions
      .install(name)
      .then((spec) => {
        if (spec && isObservableFunctionSpec(spec)) {
          create(server, name, id, payload)
          if (!client.ws?.obs.has(id)) {
            destroy(server, id)
          } else {
            subscribe(server, id, checksum, client)
          }
        } else {
          sendError(server, client, BasedErrorCode.FunctionNotFound, route)
        }
      })
      .catch(() => {
        sendError(server, client, BasedErrorCode.FunctionNotFound, route)
      })
  }
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

  const route = server.functions.route(name)

  if (!route || !route.observable) {
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

  // TODO: either make a 'worker' client and norma client or move auth to worker for this as well...
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
        sendError(server, client, BasedErrorCode.AuthorizeRejectedError, route)
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
      destroy(server, id)
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

  if (unsubscribe(server, id, client)) {
    client.ws.unsubscribe(String(id))
  }

  return true
}
