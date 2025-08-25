import { PropDef } from '@based/schema/def'
import { Ctx } from '../Ctx.js'
import { deleteString, writeString } from './string.js'
import { CREATE } from '../types.js'
import { LangCode } from '@based/schema'

export const writeText = (ctx: Ctx, def: PropDef, val: any) => {
  if (val === null) {
    deleteString(ctx, def, ctx.locale)
  } else if (typeof val === 'string' || val instanceof Uint8Array) {
    if (!ctx.locale) {
      throw [def, val]
    }
    if (!ctx.schema.separateTextSort.localeToIndex.has(ctx.locale)) {
      throw [def, val, 'Invalid locale']
    }

    writeString(ctx, def, val, ctx.locale)

    if (ctx.operation === CREATE) {
      const index = def.prop * (ctx.schema.localeSize + 1)
      const langIndex = ctx.schema.separateTextSort.localeToIndex.get(
        ctx.locale,
      )
      ctx.schema.separateTextSort.bufferTmp[index] -= 1
      ctx.schema.separateTextSort.bufferTmp[index + langIndex] = 0
      ctx.cursor.sortText ??= 0
      ctx.cursor.sortText++
      if (ctx.schema.hasSeperateDefaults) {
        ctx.schema.separateDefaults.bufferTmp[def.prop] = 1
        ctx.cursor.defaults ??= 0
        ctx.cursor.defaults++
      }
    }
  } else if (typeof val === 'object') {
    if (ctx.operation === CREATE && ctx.schema.hasSeperateDefaults) {
      ctx.cursor.defaults ??= 0
      ctx.cursor.defaults++
    }

    for (const lang in val) {
      const langU8 = ctx.schema.separateTextSort.localeStringToIndex.get(lang)
      if (!langU8) {
        throw [def, val, 'Invalid locale']
      }
      const text = val[lang]
      writeString(ctx, def, text, langU8[1] as LangCode)

      if (ctx.operation === CREATE) {
        const index = def.prop * (1 + ctx.schema.localeSize)
        ctx.schema.separateTextSort.bufferTmp[index] -= 1
        ctx.schema.separateTextSort.bufferTmp[index + langU8[0]] = 0
        ctx.cursor.sortText ??= 0
        ctx.cursor.sortText++
        if (ctx.schema.hasSeperateDefaults) {
          ctx.schema.separateDefaults.bufferTmp[def.prop]++
        }
      }
    }
  } else {
    throw [def, val]
  }
}
