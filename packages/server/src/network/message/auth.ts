import uws from '@based/uws'
import {
  valueToBuffer,
  decodePayload,
  encodeAuthResponse,
} from '../../protocol'
import { BasedServer } from '../../server'

export type AuthState = any

export const authMessage = (
  arr: Uint8Array,
  start: number,
  len: number,
  isDeflate: boolean,
  ws: uws.WebSocket,
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
  if (!ws.closed) {
    ws.authState = authState

    if (ws.unauthorizedObs) {
      ws.unauthorizedObs.forEach((observableId: number) => {
        ws.subscribe(String(observableId))
        if (!ws.obs) ws.obs = new Set()
        ws.obs.add(observableId)
        ws.unauthorizedObs.delete(observableId)
      })
      // TODO: how to trigger update observable
    }

    // TODO:: handle change authState when observables exist

    ws.send(encodeAuthResponse(valueToBuffer(true)), true, false)
  }

  return true
}
