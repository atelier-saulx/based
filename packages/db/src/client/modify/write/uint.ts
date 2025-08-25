import { writeUint16, writeUint32 } from '@based/utils'
import { Ctx } from '../Ctx.js'

export const writeU32 = (ctx: Ctx, val: number) => {
  writeUint32(ctx.array, val, ctx.index)
  ctx.index += 4
}

export const writeU16 = (ctx: Ctx, val: number) => {
  writeUint16(ctx.array, val, ctx.index)
  ctx.index += 2
}
