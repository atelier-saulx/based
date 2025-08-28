import { Ctx } from './Ctx.js'
import { RANGE_ERR } from './types.js'

export const resize = (ctx: Ctx, size: number) => {
  if (size > ctx.max) {
    throw RANGE_ERR
  }
  if (size > ctx.array.buffer.byteLength) {
    if ('resize' in ctx.array.buffer) {
      ctx.array.buffer.resize(
        Math.min(
          ctx.array.buffer.maxByteLength,
          ctx.array.buffer.byteLength * 2,
        ),
      )
    } else {
      throw RANGE_ERR
    }
  }
}

export const reserve = (ctx: Ctx, size: number) => {
  resize(ctx, ctx.index + size)
}
