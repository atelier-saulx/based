import { langCodesMap, LangCode } from '@based/schema'
import { ModifyCtx } from '../../index.js'
import { ModifyOp, ModifyErr, CREATE } from './types.js'
import { SchemaTypeDef, PropDef } from '@based/schema/def'
import { writeString } from './string.js'
import { ModifyError, ModifyState } from './ModifyRes.js'

export function writeText(
  value: { [k: string]: Parameters<typeof writeString>[1] },
  ctx: ModifyCtx,
  def: SchemaTypeDef,
  t: PropDef,
  res: ModifyState,
  modifyOp: ModifyOp,
): ModifyErr {
  // todo proper fallback as well
  if (value && typeof value !== 'object') {
    const locale = res.locale ?? langCodesMap.get('en') // TODO: Add def lang option...
    const err = writeString(res.locale, value, ctx, def, t, res.tmpId, modifyOp)
    if (modifyOp === CREATE) {
      const index = t.prop * (def.localeSize + 1)
      const langIndex = def.seperateTextSort.localeToIndex.get(locale)
      def.seperateTextSort.bufferTmp[index] -= 1
      def.seperateTextSort.bufferTmp[index + langIndex] = 0
      ctx.hasSortText += 1
    }
    return err
  } else {
    for (const lang in value) {
      const langC: Uint8Array =
        def.seperateTextSort.localeStringToIndex.get(lang)
      if (!langC) {
        return new ModifyError(t, lang, 'Invalid locale')
      }
      const s = value[lang]
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
