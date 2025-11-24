import { Ctx } from '../Ctx.js'
import { reserve } from '../resize.js'
import { writeEdgeHeader } from './header.js'
import { writeCardinalityRaw } from '../props/cardinality.js'
import { PROP_CURSOR_SIZE } from '../cursor.js'
import type { PropDefEdge } from '@based/schema'
import { PropType } from '../../../zigTsExports.js'

export const writeCardinalityEdge = (ctx: Ctx, edge: PropDefEdge, val: any) => {
  if (!Array.isArray(val)) {
    val = [val]
  }
  const size = 4 + val.length * 8
  reserve(ctx, PROP_CURSOR_SIZE + size)
  writeEdgeHeader(ctx, edge, PropType.cardinality)
  writeCardinalityRaw(ctx, edge, val, size)
}
