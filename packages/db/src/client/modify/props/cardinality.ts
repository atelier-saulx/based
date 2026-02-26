import { PropDef, PropDefEdge, CARDINALITY_RAW } from '@based/schema/def'
import { Ctx } from '../Ctx.js'
import { deleteProp } from './delete.js'
import { writeU32, writeU8, writeU8Array } from '../uint.js'
import { validate } from '../validate.js'
import { xxHash64 } from '../../xxHash64.js'
import { ENCODER } from '@based/utils'
import { reserve } from '../resize.js'
import { PROP_CURSOR_SIZE, writePropCursor } from '../cursor.js'
import { CREATE } from '../types.js'
import { writeBinary, writeBinaryRaw } from './binary.js'

// MV: must processes cardinaltyRaw PropType differently because these functions are designed to
// convert hash64 to []u8 and and strings to hash64 to []u8
// not to receive an hll encoded in selvaString encoded in []u8.

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
    if (ctx.unsafe) {
      const size = val.byteLength
      reserve(ctx, PROP_CURSOR_SIZE + size + 5)
      writePropCursor(ctx, def, CARDINALITY_RAW)
      writeU8(ctx, ctx.operation)
      writeU32(ctx, size)
      writeU8Array(ctx, val)
    } else {
      writeBinary(ctx, def, val, true)
    }
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
