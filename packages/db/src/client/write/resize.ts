import { RANGE_ERR } from '../modify/types.js'
import { Ctx } from './Ctx.js'

export const resize = (ctx: Ctx, end: number) => {
  if (end > ctx.max) {
    throw RANGE_ERR
  }
  if (end > ctx.array.buffer.byteLength) {
    ctx.array.buffer.resize(end)
  }
}
