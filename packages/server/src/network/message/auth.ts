import {
  valueToBuffer,
  decodePayload,
  encodeAuthResponse,
} from '../../protocol'
import { BasedServer } from '../../server'
import { WebsocketClient } from '../../types'
import { create, destroy, subscribe } from '../../observable'
import { isObservableFunctionSpec } from '../../functions'

export type AuthState = any

export const authMessage = (
  arr: Uint8Array,
  start: number,
  len: number,
  isDeflate: boolean,
  client: WebsocketClient,
  // eslint-disable-next-line
  server: BasedServer
): boolean => {
  // | 4 header | * payload |

  const authPayload = decodePayload(
    new Uint8Array(arr.slice(start + 4, start + len)),
    isDeflate
  )

  // authorizeHandshake here

  let authState: AuthState
  try {
    // this has to be part of the handshake
    authState = JSON.parse(authPayload)
  } catch (err) {
    console.error("can't decode auth payload", err)
  }
  if (client.ws) {
    client.ws.authState = authState

    if (client.ws.unauthorizedObs.size) {
      client.ws.unauthorizedObs.forEach((obs) => {
        const { id, name, checksum, payload } = obs
        // TODO: DRY
        client.ws.subscribe(String(id))
        client.ws.obs.add(id)

        if (server.activeObservablesById.has(id)) {
          subscribe(server, id, checksum, client)
        } else {
          server.functions
            .get(name)
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
                console.error('No function for you', name)
              }
            })
            .catch((err) => {
              console.error('fn does not exist', err)
            })
        }
      })
      //
      client.ws.unauthorizedObs.clear()
    }

    client.ws.send(encodeAuthResponse(valueToBuffer(true)), true, false)
  }

  return true
}
