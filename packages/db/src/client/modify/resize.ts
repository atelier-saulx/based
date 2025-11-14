import { Ctx } from './Ctx.ts'
import { RANGE_ERR } from './types.ts'

export const resize = (ctx: Ctx, size: number) => {
  if (size > ctx.max) {
    throw RANGE_ERR
  }
  if (size > ctx.size) {
    const avail = ctx.array.buffer.maxByteLength
    const affix = avail - ctx.max
    const required = size + affix
    const double = Math.max(required, ctx.size * 2)
    const length = Math.min(avail, double)
    // @ts-ignore
    ctx.array.buffer.resize(length)
    ctx.size = length - affix
  }
}

export const reserve = (ctx: Ctx, size: number) => {
  resize(ctx, ctx.index + size)
}
