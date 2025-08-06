import { BasedServer } from '../../server.js'
import { decodeHeader } from '../../protocol.js'
import { functionMessage } from './function.js'
import { subscribeMessage, unsubscribeMessage } from './query.js'
import { authMessage } from './auth.js'
import { getMessage } from './get.js'
import { WebSocketSession, Context } from '@based/functions'
import { createError } from '../../error/index.js'
import {
  channelSubscribeMessage,
  unsubscribeChannelMessage,
} from './channelSubscribe.js'
import { channelPublishMessage } from './channelPublish.js'
import { receiveChunkStream, registerStream } from './stream.js'
import { BasedErrorCode } from '@based/errors'
import { readUint32 } from '@based/utils'

const reader = (
  server: BasedServer,
  ctx: Context<WebSocketSession>,
  arr: Uint8Array,
  start: number,
): number => {
  // decode from buffer
  const { len, isDeflate, type } = decodeHeader(readUint32(arr, start))
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

  // type 7.x = subType
  if (type === 7) {
    const subType = arr[start + 4]

    // type 7.0 = channelUnsubscribe
    if (subType === 0) {
      if (unsubscribeChannelMessage(arr, start, len, isDeflate, ctx, server)) {
        return next
      }
    }

    // type 7.1 = register stream
    if (subType === 1) {
      if (registerStream(arr, start, len, isDeflate, ctx, server)) {
        return next
      }
    }

    // type 7.2 = chunk
    if (subType === 2) {
      if (receiveChunkStream(arr, start, len, isDeflate, ctx, server)) {
        return next
      }
    }
  }

  return next
}

export const message = (
  server: BasedServer,
  ctx: Context<WebSocketSession>,
  msg: ArrayBuffer,
  isBinary: boolean,
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
    // TODO if next > len illegal request abort & block
  }
}
