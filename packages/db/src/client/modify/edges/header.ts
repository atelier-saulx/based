import { MICRO_BUFFER, PropDefEdge } from '@based/schema/def'
import { Ctx } from '../Ctx.ts'
import { UPDATE, UPDATE_PARTIAL } from '../types.ts'

export const writeEdgeHeader = (ctx: Ctx, edge: PropDefEdge, type: number) => {
  ctx.array[ctx.index] = UPDATE
  ctx.array[ctx.index + 1] = edge.prop
  ctx.array[ctx.index + 2] = type
  ctx.index += 3
}

export const writeEdgeHeaderMain = (ctx: Ctx) => {
  ctx.array[ctx.index] = UPDATE
  ctx.array[ctx.index + 1] = 0
  ctx.array[ctx.index + 2] = MICRO_BUFFER
  ctx.index += 3
}

export const writeEdgeHeaderPartial = (ctx: Ctx) => {
  ctx.array[ctx.index] = UPDATE_PARTIAL
  ctx.array[ctx.index + 1] = 0
  ctx.array[ctx.index + 2] = MICRO_BUFFER
  ctx.index += 3
}
