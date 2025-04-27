import { langCodesMap, LangCode } from '@based/schema'
import { ModifyCtx } from '../../index.js'
import {
  ModifyOp,
  ModifyErr,
  CREATE,
  UPDATE,
  RANGE_ERR,
  DELETE,
  SIZE,
} from './types.js'
import { SchemaTypeDef, PropDef } from '@based/schema/def'
import { writeString } from './string.js'
import { ModifyError, ModifyState } from './ModifyRes.js'
import { setCursor } from './setCursor.js'

export function writeText(
  value:
    | { [k: string]: Parameters<typeof writeString>[1] }
    | Parameters<typeof writeString>[1],
  ctx: ModifyCtx,
  def: SchemaTypeDef,
  t: PropDef,
  res: ModifyState,
  parentId: number,
  modifyOp: ModifyOp,
): ModifyErr {
  if (value === null && !res.locale) {
    if (modifyOp === UPDATE) {
      if (ctx.len + SIZE.DEFAULT_CURSOR + 1 > ctx.max) {
        return RANGE_ERR
      }
      setCursor(ctx, def, t.prop, t.typeIndex, parentId, modifyOp)
      ctx.buf[ctx.len++] = DELETE
    }
    return
  }

  if ((value && typeof value !== 'object') || value === null || value === '') {
    let locale = res.locale
    if (!locale) {
      // TODO: Add def lang option...
      for (const localeCode of def.seperateTextSort.localeToIndex.keys()) {
        locale = localeCode
        break
      }
    }

    if (!def.seperateTextSort.localeToIndex.has(locale)) {
      return new ModifyError(t, locale, 'Invalid locale')
    }

    if (value == null) {
      // @ts-ignore
      value = ''
    }
    const err = writeString(
      res.locale,
      value as string,
      ctx,
      def,
      t,
      res.tmpId,
      modifyOp,
    )
    if (modifyOp === CREATE) {
      const index = t.prop * (def.localeSize + 1)
      const langIndex = def.seperateTextSort.localeToIndex.get(locale)
      def.seperateTextSort.bufferTmp[index] -= 1
      def.seperateTextSort.bufferTmp[index + langIndex] = 0
      ctx.hasSortText += 1
    }
    return err
  } else {
    // @ts-ignore
    for (const lang in value) {
      const langC: Uint8Array =
        def.seperateTextSort.localeStringToIndex.get(lang)
      if (!langC) {
        return new ModifyError(t, lang, 'Invalid locale')
      }
      let s = value[lang]
      if (s == null) {
        // @ts-ignore
        s = ''
      }
      const err = writeString(
        langC[1] as LangCode,
        s,
        ctx,
        def,
        t,
        res.tmpId,
        modifyOp,
      )
      if (err) {
        return err
      }
      const index = t.prop * (1 + def.localeSize)
      def.seperateTextSort.bufferTmp[index] -= 1
      def.seperateTextSort.bufferTmp[index + langC[0]] = 0
      ctx.hasSortText += 1
    }
  }
}
