import { MICRO_BUFFER, PropDefEdge } from '@based/schema/def'
import { Ctx } from '../Ctx.js'
import { ModOp } from '../../../zigTsExports.js'

export const writeEdgeHeader = (ctx: Ctx, edge: PropDefEdge, type: number) => {
  ctx.buf[ctx.index] = ModOp.updateProp
  ctx.buf[ctx.index + 1] = edge.prop
  ctx.buf[ctx.index + 2] = type
  ctx.index += 3
}

export const writeEdgeHeaderMain = (ctx: Ctx) => {
  ctx.buf[ctx.index] = ModOp.updateProp
  ctx.buf[ctx.index + 1] = 0
  ctx.buf[ctx.index + 2] = MICRO_BUFFER
  ctx.index += 3
}

export const writeEdgeHeaderPartial = (ctx: Ctx) => {
  ctx.buf[ctx.index] = ModOp.updatePartial
  ctx.buf[ctx.index + 1] = 0
  ctx.buf[ctx.index + 2] = MICRO_BUFFER
  ctx.index += 3
}
