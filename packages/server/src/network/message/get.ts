import uws from '@based/uws'
import { isObservableFunctionSpec } from '../../functions'
import {
  decodePayload,
  decodeName,
  readUint8,
  encodeGetResponse,
} from '../../protocol'
import { BasedServer } from '../../server'
import { create, destroy } from '../../observable'
import { ActiveObservable } from '../../types'

const sendGetData = (
  server: BasedServer,
  id: number,
  obs: ActiveObservable,
  checksum: number,
  ws: uws.WebSocket
) => {
  if (ws.closed) {
    return
  }

  if (checksum === 0) {
    ws.send(obs.cache, true, false)
  } else if (checksum === obs.checksum) {
    ws.send(encodeGetResponse(id), true, false)
  } else if (obs.diffCache && obs.previousChecksum === checksum) {
    ws.send(obs.diffCache, true, false)
  } else {
    ws.send(obs.cache, true, false)
  }

  if (obs.clients.size === 0) {
    destroy(server, id)
  }
}

export const getMessage = (
  arr: Uint8Array,
  start: number,
  len: number,
  isDeflate: boolean,
  ws: uws.WebSocket,
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

  const payload = decodePayload(
    new Uint8Array(arr.slice(start + 21 + nameLen, start + len)),
    isDeflate
  )

  // authorize here

  if (server.activeObservablesById.has(id)) {
    const obs = server.activeObservablesById.get(id)
    if (obs.beingDestroyed) {
      clearTimeout(obs.beingDestroyed)
      obs.beingDestroyed = null
    }
    if (obs.cache) {
      sendGetData(server, id, obs, checksum, ws)
    } else {
      if (!obs.onNextData) {
        obs.onNextData = new Set()
      }
      obs.onNextData.add(() => {
        sendGetData(server, id, obs, checksum, ws)
      })
    }
  } else {
    server.functions
      .get(name)
      .then((spec) => {
        if (spec && isObservableFunctionSpec(spec)) {
          const obs = create(server, name, id, payload)
          if (!ws.obs.has(id)) {
            if (!obs.onNextData) {
              obs.onNextData = new Set()
            }
            obs.onNextData.add(() => {
              sendGetData(server, id, obs, checksum, ws)
            })
          }
        } else {
          console.error('No function for you', name)
        }
      })
      .catch((err) => {
        console.error('fn does not exist', err)
      })
  }

  return true
}
