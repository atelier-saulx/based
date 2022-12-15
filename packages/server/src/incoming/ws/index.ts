import { BasedServer } from '../../server'
import { decodeHeader, readUint8 } from '../../protocol'
import { functionMessage } from './function'
import { subscribeMessage, unsubscribeMessage } from './observable'
import { authMessage } from './auth'
import { getMessage } from './get'
import { WebsocketClient } from '../../client'
import { BasedErrorCode, createError } from '../../error'

const reader = (
  server: BasedServer,
  client: WebsocketClient,
  arr: Uint8Array,
  start: number
): number => {
  const { len, isDeflate, type } = decodeHeader(readUint8(arr, start, 4))
  const next = len + start

  // type 0 = function
  if (
    type === 0 &&
    functionMessage(arr, start, len, isDeflate, client, server)
  ) {
    return next
  }

  // type 1 = subscribe
  if (
    type === 1 &&
    subscribeMessage(arr, start, len, isDeflate, client, server)
  ) {
    return next
  }

  // type 2 = unsubscribe
  if (type === 2 && unsubscribeMessage(arr, start, client, server)) {
    return next
  }

  // type 3 = get
  if (type === 3 && getMessage(arr, start, len, isDeflate, client, server)) {
    return next
  }

  // type 4 = auth
  if (type === 4 && authMessage(arr, start, len, isDeflate, client, server)) {
    return next
  }

  return next

  // emit whats wrong
  // console.warn('Unsupported incoming message with type', type)
}

export const message = (
  server: BasedServer,
  client: WebsocketClient,
  msg: ArrayBuffer,
  isBinary: boolean
) => {
  if (!client.ws) {
    return
  }

  if (!isBinary) {
    createError(server, client.ws, BasedErrorCode.NoBinaryProtocol, {
      buffer: msg,
    })

    client.ws.close()
    return
  }

  // check if msg if empty (0) then it idle timeout
  const uint8View = new Uint8Array(msg)
  const len = uint8View.length
  let next = 0
  while (next < len) {
    const n = reader(server, client, uint8View, next)
    if (n === undefined) {
      // Malformed message close client - maybe a bit too extreme...
      client.ws.close()
      return
    }
    next = n
  }
}
