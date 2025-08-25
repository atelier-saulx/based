import { PropDefEdge, REFERENCES } from '@based/schema/def'
import { Ctx } from '../../Ctx.js'
import { reserve } from '../../resize.js'
import { writeU32 } from '../uint.js'
import { writeEdgeHeader } from './header.js'

export const writeReferencesEdge = (ctx: Ctx, edge: PropDefEdge, vals: any) => {
  if (vals === null) {
    reserve(ctx, 3 + 4)
    writeEdgeHeader(ctx, edge, REFERENCES)
    writeU32(ctx, 0)
    return
  }
  if (!Array.isArray(vals)) {
    throw [edge, vals]
  }

  const size = vals.length * 4
  reserve(ctx, 3 + 4 + size)
  writeEdgeHeader(ctx, edge, REFERENCES)
  writeU32(ctx, size)
  for (let val of vals) {
    if (typeof val === 'object') {
      if (val.id) {
        val = val.id
      } else if (typeof val.then === 'function') {
        throw val
      }
    }
    if (typeof val === 'number') {
      if (!edge.validation(val, edge)) {
        throw [edge, vals]
      }
      writeU32(ctx, val)
      continue
    }
    throw [edge, vals]
  }
}
