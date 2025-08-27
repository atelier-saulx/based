import { PropDef } from '@based/schema/def'
import { Ctx } from '../Ctx.js'
import { LangCode } from '@based/schema'
import { CREATE, DELETE, DELETE_TEXT_FIELD, UPDATE } from '../types.js'
import { PROP_CURSOR_SIZE, writePropCursor } from '../cursor.js'
import { reserve } from '../resize.js'
import { ENCODER, writeUint32 } from '@based/utils'
import { write } from '../../string.js'
import { writeU8, writeU8Array } from '../uint.js'
import { markString } from '../create/mark.js'
import { validate } from '../validate.js'

export const deleteString = (ctx: Ctx, def: PropDef, lang: LangCode): void => {
  if (ctx.operation !== UPDATE) {
    return
  }
  if (lang === 0) {
    reserve(ctx, PROP_CURSOR_SIZE + 1)
    writePropCursor(ctx, def)
    writeU8(ctx, DELETE)
  } else {
    reserve(ctx, PROP_CURSOR_SIZE + 2)
    writePropCursor(ctx, def)
    writeU8(ctx, DELETE_TEXT_FIELD)
    writeU8(ctx, lang)
  }
}

export const writeString = (
  ctx: Ctx,
  def: PropDef,
  val: any,
  lang: LangCode,
): void => {
  const isUint8 = val instanceof Uint8Array
  if (val === null || val === '' || (isUint8 && val.byteLength === 0)) {
    deleteString(ctx, def, lang)
    return
  }

  validate(def, val)
  let size = isUint8 ? val.byteLength : ENCODER.encode(val).byteLength + 6
  reserve(ctx, PROP_CURSOR_SIZE + 11 + size)
  writePropCursor(ctx, def)
  writeU8(ctx, ctx.operation)
  const index = ctx.index
  ctx.index += 4
  if (isUint8) {
    writeU8Array(ctx, val)
  } else {
    size = write(ctx.array, val, ctx.index, def.compression === 0, lang)
    ctx.index += size
  }
  writeUint32(ctx.array, size, index)
  markString(ctx, def)
}
