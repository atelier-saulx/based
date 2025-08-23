import { RANGE_ERR } from '../modify/types.js'
import { Ctx } from './Ctx.js'

export const resize = (ctx: Ctx, end: number) => {
  if (end > ctx.array.buffer.byteLength) {
    if (end <= ctx.array.buffer.maxByteLength) {
      ctx.array.buffer.resize(end)
    }
    throw RANGE_ERR
  }
}
