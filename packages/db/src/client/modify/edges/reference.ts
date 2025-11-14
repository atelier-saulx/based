import type { PropDefEdge, REFERENCE } from '@based/schema/def'
import { Ctx } from '../Ctx.ts'
import { reserve } from '../resize.ts'
import { writeU32 } from '../uint.ts'
import { writeEdgeHeader } from './header.ts'
import { validate } from '../validate.ts'

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
    validate(val, edge)
    reserve(ctx, 3 + 4)
    writeEdgeHeader(ctx, edge, REFERENCE)
    writeU32(ctx, val)
    return
  }
  throw [edge, val]
}
