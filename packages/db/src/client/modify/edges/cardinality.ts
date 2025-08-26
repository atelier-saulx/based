import { PropDefEdge, CARDINALITY } from '@based/schema/def'
import { Ctx } from '../Ctx.js'
import { reserve } from '../resize.js'
import { writeU32 } from '../uint.js'
import { writeEdgeHeader } from './header.js'
import { writeCardinalityRaw } from '../props/cardinality.js'

export const writeCardinalityEdge = (ctx: Ctx, edge: PropDefEdge, val: any) => {
  if (val === null) {
    reserve(ctx, 3 + 4)
    writeEdgeHeader(ctx, edge, CARDINALITY)
    writeU32(ctx, 0)
    return
  }
  if (!Array.isArray(val)) {
    val = [val]
  }
  const size = 4 + val.length * 8
  reserve(ctx, 3 + size)
  writeEdgeHeader(ctx, edge, CARDINALITY)
  writeCardinalityRaw(ctx, edge, val)
}
