import uws from '@based/uws'
import { BasedServer } from '../../server'
import { decodeHeader, readUint8 } from '../../protocol'
import { functionMessage } from './function'
import { subscribeMessage, unsubscribeMessage } from './observable'

const reader = (
  server: BasedServer,
  ws: uws.WebSocket,
  arr: Uint8Array,
  start: number
): number => {
  const { len, isDeflate, type } = decodeHeader(readUint8(arr, start, 4))
  const next = len + start

  // type 0 = function
  if (type === 0 && functionMessage(arr, start, len, isDeflate, ws, server)) {
    return next
  }

  // type 1 = subscribe
  if (type === 1 && subscribeMessage(arr, start, len, isDeflate, ws, server)) {
    return next
  }

  // type 2 = unsubscribe
  if (type === 2 && unsubscribeMessage(arr, start, ws, server)) {
    return next
  }

  // // type 3 = get from subscription, no subscribe
  // if (type === 3) {
  //   return next
  // }

  console.warn('Unsupported incoming message with type', type)
}

export const message = (
  server: BasedServer,
  ws: uws.WebSocket,
  msg: ArrayBuffer,
  isBinary: boolean
) => {
  if (!isBinary) {
    ws.close()
    return
  }
  const uint8View = new Uint8Array(msg)
  const len = uint8View.length
  let next = 0
  while (next < len) {
    const n = reader(server, ws, uint8View, next)
    if (n === undefined) {
      // Malformed message close client
      ws.close()
      return
    }
    next = n
  }
}
