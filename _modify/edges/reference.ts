import { Ctx } from '../Ctx.js'
import { reserve } from '../resize.js'
import { writeU32 } from '../uint.js'
import { writeEdgeHeader } from './header.js'
import { validate } from '../validate.js'
import { PropType } from '../../../zigTsExports.js'
import type { PropDefEdge } from '../../../schema/index.js'

export const writeReferenceEdge = (ctx: Ctx, edge: PropDefEdge, val: any) => {
  if (val === null) {
    reserve(ctx, 3 + 4)
    writeEdgeHeader(ctx, edge, PropType.reference)
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
    writeEdgeHeader(ctx, edge, PropType.reference)
    writeU32(ctx, val)
    return
  }
  throw [edge, val]
}
