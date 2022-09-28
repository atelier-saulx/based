import {
  valueToBuffer,
  decodePayload,
  encodeAuthResponse,
} from '../../protocol'
import { BasedServer } from '../../server'
import { WebsocketClient } from '../../types'
import { enableSubscribe } from './observable'

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
        enableSubscribe(server, client, id, checksum, name, payload)
      })
      //
      client.ws.unauthorizedObs.clear()
    }

    client.ws.send(encodeAuthResponse(valueToBuffer(true)), true, false)
  }

  return true
}
