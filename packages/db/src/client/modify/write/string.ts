import { PropDef } from '@based/schema/def'
import { Ctx } from '../Ctx.js'
import { LangCode } from '@based/schema'
import { CREATE, DELETE, DELETE_TEXT_FIELD, UPDATE } from '../types.js'
import { writePropCursor } from './cursor.js'
import { reserve } from '../resize.js'
import { ENCODER, writeUint32 } from '@based/utils'
import { write } from '../../string.js'

export const deleteString = (ctx: Ctx, def: PropDef, lang: LangCode): void => {
  if (lang === 0) {
    reserve(ctx, 3 + 1)
    writePropCursor(ctx, def)
    ctx.array[ctx.index] = DELETE
    ctx.index += 1
  } else {
    reserve(ctx, 3 + 2)
    writePropCursor(ctx, def)
    ctx.array[ctx.index] = DELETE_TEXT_FIELD
    ctx.array[ctx.index + 1] = lang
    ctx.index += 2
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
    if (ctx.operation === UPDATE) {
      deleteString(ctx, def, lang)
    }
    return
  }

  if (!def.validation(val, def)) {
    throw [def, val]
  }

  const maxSize = isUint8 ? val.byteLength : ENCODER.encode(val).byteLength + 6

  reserve(ctx, 3 + 11 + maxSize)
  writePropCursor(ctx, def)

  ctx.array[ctx.index] = ctx.operation
  ctx.index += 1
  const index = ctx.index
  ctx.index += 4

  if (isUint8) {
    ctx.array.set(val, ctx.index)
    writeUint32(ctx.array, maxSize, index)
    ctx.index += maxSize
  } else {
    const realSize = write(
      ctx.array,
      val,
      ctx.index,
      def.compression === 0,
      lang,
    )
    writeUint32(ctx.array, realSize, index)
    ctx.index += realSize
  }

  if (ctx.operation === CREATE) {
    ctx.schema.separateSort.bufferTmp[def.prop] = 2
    ctx.cursor.sort ??= 0
    ctx.cursor.sort++
    if (ctx.schema.hasSeperateDefaults) {
      ctx.schema.separateDefaults.bufferTmp[def.prop] = 1
      ctx.cursor.defaults ??= 0
      ctx.cursor.defaults++
    }
  }
}
