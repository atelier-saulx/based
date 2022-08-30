import uws from '@based/uws'
import { isObservableFunctionSpec } from '../../functions'
import { decodePayload, decodeName, readUint8 } from '../../protocol'
import { BasedServer } from '../../server'
import { BasedObservableFunction } from '../../observable'

export const subscribeMessage = (
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

  if (ws.obs.has(id)) {
    // allready subscribed to this id
    return true
  }

  const payload = decodePayload(
    new Uint8Array(arr.slice(start + 21 + nameLen, start + len)),
    isDeflate
  )

  console.info('subscribe -->', name, payload, id, checksum, ws.id)

  ws.subscribe(String(id))
  ws.obs.add(id)

  const obs = server.activeObservablesById[id]
  if (obs) {
    obs.clients.add(ws.id)
    if (obs.cache && obs.checksum !== checksum) {
      // check checksum
      console.info('has cache send it')
      ws.send(obs.cache, true, false)
    }
  } else {
    server.functions
      .get(name)
      .then((spec) => {
        if (spec && isObservableFunctionSpec(spec)) {
          const obs =
            server.activeObservablesById[id] ||
            new BasedObservableFunction(server, name, payload, id)

          if (!ws.obs.has(id)) {
            if (obs.clients.size === 0) {
              obs.destroy()
            }
          } else {
            obs.clients.add(ws.id)
            if (obs.cache && obs.checksum !== checksum) {
              // check checksum
              console.info('has cache send it')
              ws.send(obs.cache, true, false)
            }
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

export const unsubscribeMessage = (
  arr: Uint8Array,
  start: number,
  ws: uws.WebSocket,
  server: BasedServer
) => {
  // | 4 header | 8 id |

  const id = readUint8(arr, start + 4, 8)

  if (!id) {
    return false
  }

  if (!ws.obs.has(id)) {
    return true
  }

  const obs = server.activeObservablesById[id]

  if (!obs) {
    return true
  }

  obs.clients.delete(ws.id)
  ws.obs.delete(id)

  if (obs.clients.size === 0) {
    obs.destroy()
  }

  return true
}
