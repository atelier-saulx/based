import { PropDef, PropDefEdge } from '@based/schema/def'
import { Ctx } from '../Ctx.js'
import { deleteProp } from './delete.js'
import { writeU32, writeU8Array } from '../uint.js'
import { validate } from '../validate.js'
import { xxHash64 } from '../../xxHash64.js'
import { ENCODER } from '@based/utils'
import { reserve } from '../resize.js'
import { PROP_CURSOR_SIZE, writePropCursor } from '../cursor.js'

export const writeCardinalityRaw = (
  ctx: Ctx,
  def: PropDef | PropDefEdge,
  val: any[],
) => {
  writeU32(ctx, 4 + val.length * 8)
  for (const item of val) {
    validate(def, item)
    if (typeof val === 'string') {
      xxHash64(ENCODER.encode(val), ctx.array, ctx.index)
      ctx.index += 8
      continue
    }
    if (val instanceof Uint8Array && val.byteLength === 8) {
      writeU8Array(ctx, val)
      continue
    }
    throw [def, val]
  }
}

export const writeCardinality = (ctx: Ctx, def: PropDef, val: any) => {
  if (val === null) {
    deleteProp(ctx, def)
    return
  }

  if (!Array.isArray(val)) {
    val = [val]
  }

  if (val.length === 0) {
    return
  }

  const size = 4 + val.length * 8
  reserve(ctx, PROP_CURSOR_SIZE + size)
  writePropCursor(ctx, def)
  writeCardinalityRaw(ctx, def, val)
}
