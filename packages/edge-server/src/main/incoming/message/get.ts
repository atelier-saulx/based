import { isObservableFunctionSpec } from '../../functions'
import {
  decodePayload,
  decodeName,
  readUint8,
  encodeGetResponse,
  updateId,
} from '../../../protocol'
import { BasedServer } from '../../server'
import { create, destroy } from '../../observable'
import { ActiveObservable, WebsocketClient } from '../../../types'
import { sendError } from './send'
import { BasedErrorCode, BasedError } from '../../error'

const obsFnError = (
  server: BasedServer,
  client: WebsocketClient,
  id: number,
  name: string,
  err: BasedError<BasedErrorCode.ObservableFunctionError>
) => {
  sendError(server, client, err.code, {
    observableId: id,
    route: {
      name,
    },
    err: err,
  })
  destroy(server, id)
}

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
    if (obs.reusedCache) {
      const prevId = updateId(obs.cache, id)
      client.ws.send(obs.cache, true, false)
      obs.cache.set(prevId, 4)
    } else {
      client.ws.send(obs.cache, true, false)
    }
  } else if (checksum === obs.checksum) {
    client.ws.send(encodeGetResponse(id), true, false)
  } else if (obs.diffCache && obs.previousChecksum === checksum) {
    if (obs.reusedCache) {
      const prevId = updateId(obs.diffCache, id)
      client.ws.send(obs.diffCache, true, false)
      obs.diffCache.set(prevId, 4)
    } else {
      client.ws.send(obs.diffCache, true, false)
    }
  } else {
    if (obs.reusedCache) {
      const prevId = updateId(obs.cache, id)
      client.ws.send(obs.cache, true, false)
      obs.cache.set(prevId, 4)
    } else {
      client.ws.send(obs.cache, true, false)
    }
  }
  destroy(server, id)
}

const getFromExisting = (
  server: BasedServer,
  id: number,
  client: WebsocketClient,
  checksum: number,
  name: string
) => {
  const obs = server.activeObservablesById.get(id)
  if (obs.beingDestroyed) {
    clearTimeout(obs.beingDestroyed)
    obs.beingDestroyed = null
  }
  if (obs.error) {
    obsFnError(server, client, id, name, obs.error)
  } else if (obs.cache) {
    sendGetData(server, id, obs, checksum, client)
  } else {
    if (!obs.onNextData) {
      obs.onNextData = new Set()
    }
    obs.onNextData.add((err) => {
      if (err) {
        obsFnError(server, client, id, name, err)
      } else {
        sendGetData(server, id, obs, checksum, client)
      }
    })
  }
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

      if (server.activeObservablesById.has(id)) {
        getFromExisting(server, id, client, checksum, name)
      } else {
        server.functions
          .install(name)
          .then((spec) => {
            if (spec && isObservableFunctionSpec(spec)) {
              if (server.activeObservablesById.has(id)) {
                getFromExisting(server, id, client, checksum, name)
              } else {
                const obs = create(server, name, id, payload)
                if (!client.ws?.obs.has(id)) {
                  if (!obs.onNextData) {
                    obs.onNextData = new Set()
                  }
                  obs.onNextData.add((err) => {
                    if (err) {
                      obsFnError(server, client, id, name, err)
                    } else {
                      sendGetData(server, id, obs, checksum, client)
                    }
                  })
                }
              }
            } else {
              sendError(server, client, BasedErrorCode.FunctionNotFound, route)
            }
          })
          .catch(() => {
            sendError(server, client, BasedErrorCode.FunctionNotFound, route)
          })
      }
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
