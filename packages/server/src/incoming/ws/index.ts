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
import {
  FunctionServerType,
  FunctionServerSubType,
} from '@based/protocol/client-server'

const reader = (
  server: BasedServer,
  ctx: Context<WebSocketSession>,
  arr: Uint8Array,
  start: number,
): number => {
  // Decode from buffer
  const { len, isDeflate, type } = decodeHeader(readUint32(arr, start))
  const next = len + start

  if (
    type === FunctionServerType.function &&
    functionMessage(arr, start, len, isDeflate, ctx, server)
  ) {
    return next
  }

  if (
    type === FunctionServerType.subscribe &&
    subscribeMessage(arr, start, len, isDeflate, ctx, server)
  ) {
    return next
  }

  if (
    type === FunctionServerType.unsubscribe &&
    unsubscribeMessage(arr, start, len, isDeflate, ctx, server)
  ) {
    return next
  }

  if (
    type === FunctionServerType.get &&
    getMessage(arr, start, len, isDeflate, ctx, server)
  ) {
    return next
  }

  if (
    type === FunctionServerType.auth &&
    authMessage(arr, start, len, isDeflate, ctx, server)
  ) {
    return next
  }

  if (
    type === FunctionServerType.channelSubscribe &&
    channelSubscribeMessage(arr, start, len, isDeflate, ctx, server)
  ) {
    return next
  }

  if (
    type === FunctionServerType.channelPublish &&
    channelPublishMessage(arr, start, len, isDeflate, ctx, server)
  ) {
    return next
  }

  if (type === FunctionServerType.subType) {
    const subType = arr[start + 4]
    if (subType === FunctionServerSubType.channelUnsubscribe) {
      if (unsubscribeChannelMessage(arr, start, len, isDeflate, ctx, server)) {
        return next
      }
    }
    if (subType === FunctionServerSubType.registerStream) {
      if (registerStream(arr, start, len, isDeflate, ctx, server)) {
        return next
      }
    }
    if (subType === FunctionServerSubType.chunk) {
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
