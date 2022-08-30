import uws from '@based/uws'
import { BasedServer } from '../../server'
import { decodeHeader, readUint8 } from '../../protocol'
import { functionMessage } from './function'

const reader = (
  server: BasedServer,
  ws: uws.WebSocket,
  arr: Uint8Array,
  start: number
): number => {
  const { len, isDeflate, type } = decodeHeader(readUint8(arr, start, 4))

  // type 0 = function
  if (type === 0) {
    functionMessage(arr, start, len, isDeflate, ws, server)
  }
  // type 1 = subscribe

  // type 2 = subscribe force reply

  // type 3 = get from subscription, no subscribe

  // type 4 =  unsubscribe
  return len + start
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
      console.error('Cannot read header!')
      return
    }
    next = n
  }
}
