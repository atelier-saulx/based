import type { PropDef, PropDefEdge } from '@based/schema/def'
import { Ctx } from '../Ctx.ts'
import { deleteProp } from './delete.ts'
import { writeU32, writeU8, writeU8Array } from '../uint.ts'
import { validate } from '../validate.ts'
import { xxHash64 } from '../../xxHash64.ts'
import { ENCODER } from '@based/utils'
import { reserve } from '../resize.ts'
import { PROP_CURSOR_SIZE, writePropCursor } from '../cursor.ts'
import { CREATE } from '../types.ts'
import { writeBinary } from './binary.ts'

export const writeCardinalityRaw = (
  ctx: Ctx,
  def: PropDef | PropDefEdge,
  val: any[],
  sizeFixBecauseEdgeIsDifferent = val.length,
) => {
  writeU32(ctx, sizeFixBecauseEdgeIsDifferent)

  for (const item of val) {
    validate(item, def)
    if (typeof item === 'string') {
      xxHash64(ENCODER.encode(item), ctx.array, ctx.index)
      ctx.index += 8
      continue
    }
    if (item instanceof Uint8Array && item.byteLength === 8) {
      writeU8Array(ctx, item)
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

  if (val instanceof Uint8Array && val.byteLength !== 8) {
    writeBinary(ctx, def, val, true)
    return
  }

  if (!Array.isArray(val)) {
    val = [val]
  }

  if (val.length === 0) {
    return
  }

  const size = PROP_CURSOR_SIZE + 1 + 4 + val.length * 8
  reserve(ctx, PROP_CURSOR_SIZE + size + 1)
  writePropCursor(ctx, def)
  writeU8(ctx, ctx.operation)
  writeU8(ctx, def.cardinalityMode)
  writeU8(ctx, def.cardinalityPrecision)
  writeCardinalityRaw(ctx, def, val)
  if (ctx.operation === CREATE) {
    ctx.schema.separateSort.bufferTmp[def.prop] = 2
    ctx.sort++
  }
}
