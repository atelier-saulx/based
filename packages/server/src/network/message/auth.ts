import uws from '@based/uws'
import {
  readUint8,
  valueToBuffer,
  decodePayload,
  encodeAuthResponse,
} from '../../protocol'
import { BasedServer } from '../../server'

export type AuthState =
  | {
      token: false
    }
  | {
      token: string
      refreshToken?: string
      user?: string
    }

export const authMessage = (
  arr: Uint8Array,
  start: number,
  len: number,
  isDeflate: boolean,
  ws: uws.WebSocket,
  server: BasedServer
): boolean => {
  // | 4 header | 3 id | * payload |

  const reqId = readUint8(arr, start + 4, 3)
  const authPayload = decodePayload(
    new Uint8Array(arr.slice(start + 7, start + len)),
    isDeflate
  )

  if (!reqId) {
    return false
  }

  let authState: AuthState
  try {
    authState = JSON.parse(authPayload)
  } catch (err) {
    console.error("can't decode auth payload", err)
  }

  ws.authState = authState
  ws.send(encodeAuthResponse(reqId, valueToBuffer(true)), true, false)

  return true
}
