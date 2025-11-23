import { writeInt64, writeUint16, writeUint32 } from '@based/utils'
import { Ctx } from './Ctx.js'

export const writeU64 = (ctx: Ctx, val: number) => {
  writeInt64(ctx.buf, val, ctx.index)
  ctx.index += 8
}

export const writeU32 = (ctx: Ctx, val: number) => {
  writeUint32(ctx.buf, val, ctx.index)
  ctx.index += 4
}

export const writePadding = (ctx: Ctx, padding: number) => {
  while (padding--) {
    ctx.buf[ctx.index++] = 0
  }
}

export const writeU16 = (ctx: Ctx, val: number) => {
  writeUint16(ctx.buf, val, ctx.index)
  ctx.index += 2
}

export const writeU8 = (ctx: Ctx, val: number) => {
  ctx.buf[ctx.index] = val
  ctx.index += 1
}

export const writeU8Array = (ctx: Ctx, val: Uint8Array) => {
  ctx.buf.set(val, ctx.index)
  ctx.index += val.byteLength
}
