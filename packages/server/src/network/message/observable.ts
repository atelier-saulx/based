import { isObservableFunctionSpec } from '../../functions'
import { decodePayload, decodeName, readUint8 } from '../../protocol'
import { BasedServer } from '../../server'
import { create, unsubscribe, destroy, subscribe } from '../../observable'
import { sendError, BasedErrorCode } from '../../error'
import { WebsocketClient } from '../../types'

export const enableSubscribe = (
  server: BasedServer,
  client: WebsocketClient,
  id: number,
  checksum: number,
  name: string,
  payload: any
) => {
  client.ws.subscribe(String(id))
  client.ws.obs.add(id)

  if (server.activeObservablesById.has(id)) {
    subscribe(server, id, checksum, client)
  } else {
    server.functions
      .install(name)
      .then((spec) => {
        if (spec && isObservableFunctionSpec(spec)) {
          const obs = create(server, name, id, payload)
          if (!client.ws?.obs.has(id)) {
            if (obs.clients.size === 0) {
              destroy(server, id)
            }
          } else {
            subscribe(server, id, checksum, client)
          }
        } else {
          sendError(client, 'Function not found', {
            basedCode: BasedErrorCode.AuthorizeError,
            observableId: id,
          })
        }
      })
      .catch((_err) => {
        sendError(client, 'Function dos not exist', {
          basedCode: BasedErrorCode.AuthorizeError,
          observableId: id,
        })
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

  if (client.ws?.obs.has(id)) {
    // allready subscribed to this id
    return true
  }

  const payload = decodePayload(
    new Uint8Array(arr.slice(start + 21 + nameLen, start + len)),
    isDeflate
  )

  server.auth.config
    .authorize(server, client, 'observe', name, payload)
    .then((ok) => {
      if (!client.ws) {
        return
      }

      if (!ok) {
        client.ws.unauthorizedObs.add({ id, checksum, name, payload })
        sendError(client, 'Not authorized', {
          basedCode: BasedErrorCode.AuthorizeRejectedError,
          observableId: id,
        })
        return false
      }

      enableSubscribe(server, client, id, checksum, name, payload)
    })
    .catch((err) => {
      sendError(client, err, {
        basedCode: BasedErrorCode.AuthorizeError,
        observableId: id,
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

  const id = readUint8(arr, start + 4, 8)

  if (!id) {
    return false
  }

  if (!client.ws) {
    return
  }

  if (!client.ws.obs.has(id)) {
    return true
  }

  client.ws.unsubscribe(String(id))

  unsubscribe(server, id, client)

  return true
}
