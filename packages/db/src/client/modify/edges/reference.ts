import { PropDefEdge, REFERENCE } from '@based/schema/def'
import { Ctx } from '../Ctx.js'
import { reserve } from '../resize.js'
import { writeU32 } from '../uint.js'
import { writeEdgeHeader } from './header.js'

export const writeReferenceEdge = (ctx: Ctx, edge: PropDefEdge, val: any) => {
  if (val === null) {
    reserve(ctx, 3 + 4)
    writeEdgeHeader(ctx, edge, REFERENCE)
    writeU32(ctx, 0)
    return
  }
  if (typeof val === 'object') {
    if (val.id) {
      val = val.id
    } else if (typeof val.then === 'function') {
      throw val
    }
  }
  if (typeof val === 'number') {
    if (!edge.validation(val, edge)) {
      throw [edge, val]
    }
    reserve(ctx, 3 + 4)
    writeEdgeHeader(ctx, edge, REFERENCE)
    writeU32(ctx, val)
    return
  }
  throw [edge, val]
}
