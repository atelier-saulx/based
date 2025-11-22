// import { PropDef } from '@based/schema/def'
import { Ctx } from '../Ctx.js'
import { deleteString, writeString } from './string.js'
import { LangCode, langCodesMap, type LeafDef } from '@based/schema'
import { markTextValue, markTextObj } from '../create/mark.js'

export const writeText = (ctx: Ctx, def: LeafDef, val: any): void => {
  if (val === null) {
    deleteString(ctx, def, ctx.locale)
    return
  }
  if (typeof val === 'string' || val instanceof Uint8Array) {
    if (!ctx.locale) {
      throw [def, val]
    }
    // if (!ctx.typeDef.separateTextSort.localeToIndex.has(ctx.locale)) {
    //   throw [def, val, 'Invalid locale']
    // }

    writeString(ctx, def, val, ctx.locale)
    markTextValue(ctx, def, ctx.locale, true)
    return
  }

  if (typeof val === 'object') {
    markTextObj(ctx)

    for (const lang in val) {
      // const langU8 = ctx.typeDef.separateTextSort.localeStringToIndex.get(lang)
      // if (!langU8) {
      //   throw [def, val, 'Invalid locale']
      // }

      if (!(lang in ctx.schema.locales)) {
        throw [def, val, 'Invalid locale']
      }
      const text = val[lang]
      const locale = langCodesMap.get(lang) as LangCode
      writeString(ctx, def, text, locale)
      markTextValue(ctx, def, locale, false)
    }
    return
  }

  throw [def, val]
}
