import { PropDefEdge, CARDINALITY } from '@based/schema/def'
import { ENCODER } from '@based/utils'
import { xxHash64 } from '../../../xxHash64.js'
import { Ctx } from '../../Ctx.js'
import { resize } from '../../resize.js'
import { writeU32 } from '../uint.js'
import { writeEdgeHeader } from './header.js'

export const writeCardinalityEdge = (
  ctx: Ctx,
  edge: PropDefEdge,
  vals: any,
) => {
  if (vals === null) {
    resize(ctx, ctx.index + 3 + 4)
    writeEdgeHeader(ctx, edge, CARDINALITY)
    writeU32(ctx, 0)
    return
  }
  if (!Array.isArray(vals)) {
    vals = [vals]
  }
  const size = 4 + vals.length * 8
  resize(ctx, ctx.index + 3 + size)
  writeEdgeHeader(ctx, edge, CARDINALITY)
  writeU32(ctx, size)
  ctx.index += 7
  for (const val of vals) {
    if (edge.validation(val, edge)) {
      if (typeof val === 'string') {
        xxHash64(ENCODER.encode(val), ctx.array, ctx.index)
        ctx.index += 8
        continue
      }
      if (val instanceof Uint8Array && val.byteLength === 8) {
        ctx.array.set(val, ctx.index)
        ctx.index += 8
        continue
      }
    }
    throw [edge, vals]
  }
}
