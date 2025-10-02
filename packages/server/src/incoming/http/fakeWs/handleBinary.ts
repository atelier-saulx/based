import { HttpSession, Context } from '@based/functions'
import { BasedServer } from '../../../server.js'
import { end } from '../../../sendHttpResponse.js'
import {
  decodeHeader,
  encodeAuthResponse,
  valueToBuffer,
} from '../../../protocol.js'
import { handleFunction } from './function.js'
import { readUint32 } from '@based/utils'
import { FunctionServerType } from '@based/protocol/client-server'
import { handleQuery } from './query.js'

const reader = (
  server: BasedServer,
  ctx: Context<HttpSession>,
  arr: Uint8Array,
  start: number,
): [number, Promise<Uint8Array>] | [undefined] | [number] => {
  const { len, isDeflate, type } = decodeHeader(readUint32(arr, start))
  const next = len + start

  if (type === FunctionServerType.function) {
    const p = handleFunction(arr, start, len, isDeflate, ctx, server)
    if (p) {
      return [next, p]
    } else {
      return [undefined]
    }
  }

  if (
    type === FunctionServerType.subscribe ||
    type === FunctionServerType.get
  ) {
    const p = handleQuery(arr, start, len, isDeflate, ctx, server)
    if (p) {
      return [next, p]
    } else {
      return [undefined]
    }
  }

  if (type === FunctionServerType.unsubscribe) {
    return [next]
  }

  if (type === FunctionServerType.auth) {
    return [next]
  }

  if (type === FunctionServerType.channelSubscribe) {
    return [next]
  }

  if (type === FunctionServerType.channelPublish) {
    return [next]
  }

  // // type 5 = channelSubscribe
  // if (
  //   type === 5 &&
  //   channelSubscribeMessage(arr, start, len, isDeflate, ctx, server)
  // ) {
  //   return next;
  // }

  // // type 6 = channelPublish
  // if (
  //   type === 6 &&
  //   channelPublishMessage(arr, start, len, isDeflate, ctx, server)
  // ) {
  //   return next;
  // }

  // // type 7.x = subType
  // if (type === 7) {
  //   const subType = readUint8(arr, start + 4, 1);
  //   // type 7.0 = channelUnsubscribe
  //   if (subType === 0) {
  //     if (unsubscribeChannelMessage(arr, start, len, isDeflate, ctx, server)) {
  //       return next;
  //     }
  //   }
  //   // type 7.1 = register stream
  //   if (subType === 1) {
  //     if (registerStream(arr, start, len, isDeflate, ctx, server)) {
  //       return next;
  //     }
  //   }
  //   // type 7.2 = chunk
  //   if (subType === 2) {
  //     if (receiveChunkStream(arr, start, len, isDeflate, ctx, server)) {
  //       return next;
  //     }
  //   }
  // }

  // return false...
  return [next]
}

export const handleBinary = async (
  server: BasedServer,
  ctx: Context<HttpSession>,
  data: Buffer,
) => {
  if (!ctx.session) {
    return
  }

  const uint8View = data
  const len = uint8View.byteLength
  let next = 0
  const q: Promise<Uint8Array>[] = []

  while (next < len) {
    if (!ctx.session) {
      return
    }
    const [n, p] = reader(server, ctx, uint8View, next)
    if (n === undefined) {
      ctx.session.res.end()
      return
    }
    if (p) {
      q.push(p)
    }
    next = n
  }

  const prevToken = ctx.session.authState.token
  const r = await Promise.all(q)

  if (!ctx.session) {
    return
  }

  if (ctx.session.authState.token || prevToken) {
    const b = encodeAuthResponse(valueToBuffer(ctx.session.authState, true))
    r.push(b)
  }

  const buf = Buffer.allocUnsafe(
    r.reduce((acc, i) => {
      if (!i.byteLength) {
        return acc
      }
      return acc + i.byteLength + 4
    }, 0),
  )
  let i = 0

  for (const x of r) {
    if (!x.byteLength) {
      continue
    }
    buf.writeUint32LE(x.byteLength, i)
    i += 4
    buf.set(x, i)
    i += x.byteLength
  }

  end(ctx, buf)
}
