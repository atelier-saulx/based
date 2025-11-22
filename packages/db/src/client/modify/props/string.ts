import { Ctx } from '../Ctx.js'
import {
  LangCode,
  type LeafDef,
  type PropDef,
  type SchemaString,
} from '@based/schema'
import { DELETE, DELETE_TEXT_FIELD, RANGE_ERR, UPDATE } from '../types.js'
import {
  FULL_CURSOR_SIZE,
  PROP_CURSOR_SIZE,
  writePropCursor,
} from '../cursor.js'
import { reserve } from '../resize.js'
import { ENCODER, writeUint32 } from '@based/utils'
import { write } from '../../string.js'
import { writeU8, writeU8Array } from '../uint.js'
import { markString } from '../create/mark.js'
import { validate } from '../validate.js'

export const deleteString = (ctx: Ctx, def: LeafDef, lang: LangCode): void => {
  if (ctx.operation !== UPDATE) {
    return
  }
  if (!lang) {
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
  def: LeafDef & { compression?: SchemaString['compression'] },
  val: any,
  lang: LangCode,
): void => {
  const isUint8 = val instanceof Uint8Array
  if (val === null || val === '' || (isUint8 && val.byteLength === 0)) {
    deleteString(ctx, def, lang)
    return
  }

  validate(val, def)
  let size: number | null = isUint8
    ? val.byteLength
    : ENCODER.encode(val).byteLength + 6
  reserve(ctx, FULL_CURSOR_SIZE + 11 + size)
  writePropCursor(ctx, def)
  writeU8(ctx, ctx.operation)
  const index = ctx.index
  ctx.index += 4
  if (isUint8) {
    writeU8Array(ctx, val)
  } else {
    size = write(ctx, val, ctx.index, def.compression === 'none', lang)
    if (size === null) {
      throw RANGE_ERR
    }
    ctx.index += size
  }
  writeUint32(ctx.array, size, index)
  markString(ctx, def)
}
