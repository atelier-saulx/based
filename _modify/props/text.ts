import { Ctx } from '../Ctx.js'
import { deleteString, writeString } from './string.js'
import type { PropDef } from '../../../schema/index.js'
import { LangCodeEnum } from '../../../zigTsExports.js'

export const writeText = (ctx: Ctx, def: PropDef, val: any): void => {
  if (val === null) {
    deleteString(ctx, def, ctx.locale)
    return
  }
  if (typeof val === 'string' || val instanceof Uint8Array) {
    if (!ctx.locale) {
      throw [def, val]
    }
    if (!ctx.schema.separateTextSort.localeToIndex.has(ctx.locale)) {
      throw [def, val, 'Invalid locale']
    }

    writeString(ctx, def, val, ctx.locale)
    return
  }

  if (typeof val === 'object') {
    for (const lang in val) {
      const langU8 = ctx.schema.separateTextSort.localeStringToIndex.get(lang)
      if (!langU8) {
        throw [def, val, 'Invalid locale']
      }
      const text = val[lang]
      const locale = langU8[1] as LangCodeEnum
      writeString(ctx, def, text, locale)
    }
    return
  }

  throw [def, val]
}
