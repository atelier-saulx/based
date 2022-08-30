import uws from '@based/uws'
import { BasedServer } from '../../server'
import { decodeHeader, readUint8 } from '../../protocol'
import { functionMessage } from './function'
import { subscribeMessage } from './observable'

const reader = (
  server: BasedServer,
  ws: uws.WebSocket,
  arr: Uint8Array,
  start: number
): number => {
  const { len, isDeflate, type } = decodeHeader(readUint8(arr, start, 4))
  const next = len + start

  console.info('incoming ->', type, len)

  // type 0 = function
  if (type === 0 && functionMessage(arr, start, len, isDeflate, ws, server)) {
    return next
  }

  // type 1 = subscribe
  if (type === 1 && subscribeMessage(arr, start, len, isDeflate, ws, server)) {
    return next
  }

  // type 2 = subscribe force reply
  if (type === 2) {
    return next
  }

  // type 3 = get from subscription, no subscribe
  if (type === 3) {
    return next
  }

  // type 4 =  unsubscribe
  if (type === 4) {
    return next
  }

  // error if not correct type!
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
  console.info('--->', msg)
  while (next < len) {
    const n = reader(server, ws, uint8View, next)
    if (n === undefined) {
      console.error('Cannot read message close client')
      ws.close()
      return
    }
    next = n
  }
}
