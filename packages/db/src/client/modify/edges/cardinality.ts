import { PropDefEdge, CARDINALITY } from '@based/schema/def'
import { Ctx } from '../Ctx.ts'
import { reserve } from '../resize.ts'
import { writeU32 } from '../uint.ts'
import { writeEdgeHeader } from './header.ts'
import { writeCardinalityRaw } from '../props/cardinality.ts'
import { PROP_CURSOR_SIZE } from '../cursor.ts'

export const writeCardinalityEdge = (ctx: Ctx, edge: PropDefEdge, val: any) => {
  if (!Array.isArray(val)) {
    val = [val]
  }
  const size = 4 + val.length * 8
  reserve(ctx, PROP_CURSOR_SIZE + size)
  writeEdgeHeader(ctx, edge, CARDINALITY)
  writeCardinalityRaw(ctx, edge, val, size)
}
