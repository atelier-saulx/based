import { langCodesMap, LangCode } from '@based/schema'
import { ModifyCtx } from '../../index.js'
import { ModifyOp, ModifyErr } from './types.js'
import { SchemaTypeDef, PropDef } from '../../server/schema/types.js'
import { writeString } from './string.js'
import { ModifyState } from './ModifyRes.js'

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
    const err = writeString(
      res.locale ?? langCodesMap.get('en'),
      value,
      ctx,
      def,
      t,
      res.tmpId,
      modifyOp,
    )
  } else {
    for (const lang in value) {
      const langCode: LangCode =
        langCodesMap.get(lang) || langCodesMap.get('en') // TODO use proper fallback
      const s = value[lang]

      const err = writeString(langCode, s, ctx, def, t, res.tmpId, modifyOp)
      if (err) {
        return err
      }
    }
  }
}
