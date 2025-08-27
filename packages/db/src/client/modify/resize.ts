import { Ctx } from './Ctx.js'
import { RANGE_ERR } from './types.js'

export const resize = (ctx: Ctx, size: number) => {
  if (size > ctx.max) {
    throw RANGE_ERR
  }
  if (size >= ctx.array.buffer.byteLength) {
    ctx.array.buffer.resize(size)
  }
}

export const reserve = (ctx: Ctx, size: number) =>
  resize(ctx, ctx.index + size + 1)
