import { langCodes, LangCode } from '@based/schema'
import { ModifyCtx } from '../../index.js'
import { ModifyOp, ModifyErr } from './types.js'
import { SchemaTypeDef, PropDef } from '../../server/schema/types.js'
import { writeString } from './string.js'

export function writeText(
  value: any, // TODO YOLO
  ctx: ModifyCtx,
  def: SchemaTypeDef,
  t: PropDef,
  parentId: number,
  modifyOp: ModifyOp,
): ModifyErr {
  for (const lang in value) {
    const langCode: LangCode = langCodes[lang] || langCodes['en'] // TODO use proper fallback
    const s = value[lang]

    // TODO put langCode

    const err = writeString(s, ctx, def, t, parentId, modifyOp)
    if (err) {
      return err
    }
  }
}
