import { BasedServer } from '../../server'
import { decodeHeader, readUint8 } from '../../protocol'
import { functionMessage } from './function'
import { subscribeMessage, unsubscribeMessage } from './query'
import { authMessage } from './auth'
import { getMessage } from './get'
import { WebSocketSession, Context } from '@based/functions'
import { BasedErrorCode, createError } from '../../error'
import {
  channelSubscribeMessage,
  unsubscribeChannelMessage,
} from './channelSubscribe'
import { channelPublishMessage } from './channelPublish'

const reader = (
  server: BasedServer,
  ctx: Context<WebSocketSession>,
  arr: Uint8Array,
  start: number
): number => {
  const { len, isDeflate, type } = decodeHeader(readUint8(arr, start, 4))
  const next = len + start

  // type 0 = function
  if (type === 0 && functionMessage(arr, start, len, isDeflate, ctx, server)) {
    return next
  }

  // type 1 = subscribe
  if (type === 1 && subscribeMessage(arr, start, len, isDeflate, ctx, server)) {
    return next
  }

  // type 2 = unsubscribe
  if (
    type === 2 &&
    unsubscribeMessage(arr, start, len, isDeflate, ctx, server)
  ) {
    return next
  }

  // type 3 = get
  if (type === 3 && getMessage(arr, start, len, isDeflate, ctx, server)) {
    return next
  }

  // type 4 = auth
  if (type === 4 && authMessage(arr, start, len, isDeflate, ctx, server)) {
    return next
  }

  // type 5 = channelSubscribe
  if (
    type === 5 &&
    channelSubscribeMessage(arr, start, len, isDeflate, ctx, server)
  ) {
    return next
  }

  // type 6 = channelPublish
  if (
    type === 6 &&
    channelPublishMessage(arr, start, len, isDeflate, ctx, server)
  ) {
    return next
  }

  // type 7 = channelUnsubscribe
  if (
    type === 7 &&
    unsubscribeChannelMessage(arr, start, len, isDeflate, ctx, server)
  ) {
    return next
  }

  return next
}

export const message = (
  server: BasedServer,
  ctx: Context<WebSocketSession>,
  msg: ArrayBuffer,
  isBinary: boolean
) => {
  if (!ctx.session) {
    return
  }
  if (!isBinary) {
    createError(server, ctx, BasedErrorCode.NoBinaryProtocol, {
      buffer: msg,
    })
    ctx.session.ws.close()
    return
  }

  // If msg if empty (0) then it is an idle timeout
  const uint8View = new Uint8Array(msg)
  const len = uint8View.length
  let next = 0
  while (next < len) {
    if (!ctx.session) {
      return
    }
    const n = reader(server, ctx, uint8View, next)
    if (n === undefined) {
      // Malformed message close client - maybe a bit too extreme...
      ctx.session.ws.close()
      return
    }
    next = n
  }
}
