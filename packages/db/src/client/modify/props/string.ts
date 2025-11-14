import type { PropDef } from '@based/schema/def'
import { Ctx } from '../Ctx.ts'
import type { LangCode } from '@based/schema'
import {
  CREATE,
  DELETE,
  DELETE_TEXT_FIELD,
  RANGE_ERR,
  UPDATE,
} from '../types.ts'
import {
  FULL_CURSOR_SIZE,
  PROP_CURSOR_SIZE,
  writePropCursor,
} from '../cursor.ts'
import { reserve } from '../resize.ts'
import { ENCODER, writeUint32 } from '@based/utils'
import { write } from '../../string.ts'
import { writeU8, writeU8Array } from '../uint.ts'
import { markString } from '../create/mark.ts'
import { validate } from '../validate.ts'

export const deleteString = (ctx: Ctx, def: PropDef, lang: LangCode): void => {
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
  def: PropDef,
  val: any,
  lang: LangCode,
): void => {
  const isUint8 = val instanceof Uint8Array
  if (val === null || val === '' || (isUint8 && val.byteLength === 0)) {
    deleteString(ctx, def, lang)
    return
  }

  validate(val, def)
  let size = isUint8 ? val.byteLength : ENCODER.encode(val).byteLength + 6
  reserve(ctx, FULL_CURSOR_SIZE + 11 + size)
  writePropCursor(ctx, def)
  writeU8(ctx, ctx.operation)
  const index = ctx.index
  ctx.index += 4
  if (isUint8) {
    writeU8Array(ctx, val)
  } else {
    size = write(ctx, val, ctx.index, def.compression === 0, lang)
    if (size === null) {
      throw RANGE_ERR
    }
    ctx.index += size
  }
  writeUint32(ctx.array, size, index)
  markString(ctx, def)
}
