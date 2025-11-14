import { PropDef } from '@based/schema/def'
import { Ctx } from '../Ctx.ts'
import { deleteString, writeString } from './string.ts'
import { LangCode } from '@based/schema'
import { markTextValue, markTextObj } from '../create/mark.ts'

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
    markTextValue(ctx, def, ctx.locale, true)
    return
  }

  if (typeof val === 'object') {
    markTextObj(ctx)

    for (const lang in val) {
      const langU8 = ctx.schema.separateTextSort.localeStringToIndex.get(lang)
      if (!langU8) {
        throw [def, val, 'Invalid locale']
      }
      const text = val[lang]
      const locale = langU8[1] as LangCode
      writeString(ctx, def, text, locale)
      markTextValue(ctx, def, locale, false)
    }
    return
  }

  throw [def, val]
}
