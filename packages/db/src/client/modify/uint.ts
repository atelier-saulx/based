import { writeInt64, writeUint16, writeUint32 } from '@based/utils'
import { Ctx } from './Ctx.ts'

export const writeU64 = (ctx: Ctx, val: number) => {
  writeInt64(ctx.array, val, ctx.index)
  ctx.index += 8
}

export const writeU32 = (ctx: Ctx, val: number) => {
  writeUint32(ctx.array, val, ctx.index)
  ctx.index += 4
}

export const writePadding = (ctx: Ctx, padding: number) => {
  while (padding--) {
    ctx.array[ctx.index++] = 0
  }
}

export const writeU16 = (ctx: Ctx, val: number) => {
  writeUint16(ctx.array, val, ctx.index)
  ctx.index += 2
}

export const writeU8 = (ctx: Ctx, val: number) => {
  ctx.array[ctx.index] = val
  ctx.index += 1
}

export const writeU8Array = (ctx: Ctx, val: Uint8Array) => {
  ctx.array.set(val, ctx.index)
  ctx.index += val.byteLength
}
