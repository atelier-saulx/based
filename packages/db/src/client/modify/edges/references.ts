import { PropDefEdge, REFERENCES } from '@based/schema/def'
import { Ctx } from '../Ctx.ts'
import { reserve } from '../resize.ts'
import { writePadding, writeU32 } from '../uint.ts'
import { writeEdgeHeader } from './header.ts'
import { validate } from '../validate.ts'

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

  const size = vals.length * 4 + 3 // add 3 padding
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
      validate(val, edge)
      writeU32(ctx, val)
      continue
    }
    throw [edge, vals]
  }
  writePadding(ctx, 3)
}
