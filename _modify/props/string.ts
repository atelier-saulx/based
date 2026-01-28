import native from '../../../native.js'
import { Ctx } from '../Ctx.js'
import { RANGE_ERR } from '../types.js'
import {
  FULL_CURSOR_SIZE,
  PROP_CURSOR_SIZE,
  writePropCursor,
} from '../cursor.js'
import { reserve } from '../resize.js'
import { write } from '../../string.js'
import { writeU8, writeU8Array } from '../uint.js'
import { validate } from '../validate.js'
import { LangCodeEnum, ModOp } from '../../../zigTsExports.js'
import type { PropDef } from '../../../schema/index.js'
import { writeUint32 } from '../../../utils/uint8.js'

export const deleteString = (
  ctx: Ctx,
  def: PropDef,
  lang: LangCodeEnum,
): void => {
  if (ctx.operation !== ModOp.updateProp) {
    return
  }
  if (!lang) {
    reserve(ctx, PROP_CURSOR_SIZE + 1)
    writePropCursor(ctx, def)
    writeU8(ctx, ModOp.delete)
  } else {
    reserve(ctx, PROP_CURSOR_SIZE + 2)
    writePropCursor(ctx, def)
    writeU8(ctx, ModOp.deleteTextField)
    writeU8(ctx, lang)
  }
}

export const writeString = (
  ctx: Ctx,
  def: PropDef,
  val: any,
  lang: LangCodeEnum,
): void => {
  const isUint8 = val instanceof Uint8Array
  if (val === null || val === '' || (isUint8 && val.byteLength === 0)) {
    deleteString(ctx, def, lang)
    return
  }

  validate(val, def)
  let size = isUint8 ? val.byteLength : native.stringByteLength(val) + 6
  reserve(ctx, FULL_CURSOR_SIZE + 11 + size)
  writePropCursor(ctx, def)
  writeU8(ctx, ctx.operation)
  const index = ctx.index
  ctx.index += 4
  if (isUint8) {
    writeU8Array(ctx, val)
  } else {
    size = write(ctx, val, ctx.index, lang, def.compression === 0)
    if (size === null) {
      throw RANGE_ERR
    }
    ctx.index += size
  }
  writeUint32(ctx.buf, size, index)
}
