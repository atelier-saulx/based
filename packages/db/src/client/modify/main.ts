import { BasedDb } from '../../index.js'
import { ModifyOp, MERGE_MAIN, ModifyErr, RANGE_ERR } from './types.js'
import { ModifyError, ModifyState } from './ModifyRes.js'
import { setCursor } from './setCursor.js'
import {
  appendU32,
  appendU8,
  appendZeros,
  outOfRange,
  writeFixedValue,
} from './utils.js'
import { PropDef, SchemaTypeDef } from '../../server/schema/types.js'

export function writeMain(
  value: string | null,
  ctx: BasedDb['modifyCtx'],
  schema: SchemaTypeDef,
  def: PropDef,
  res: ModifyState,
  modifyOp: ModifyOp,
  overwrite: boolean,
): ModifyErr {
  if (overwrite) {
    if (outOfRange(ctx, 15 + schema.mainLen)) {
      return RANGE_ERR
    }
    setCursor(ctx, schema, def.prop, res.tmpId, modifyOp, true)
    if (ctx.lastMain === -1) {
      setCursor(ctx, schema, def.prop, res.tmpId, modifyOp)
      appendU8(ctx, overwrite ? modifyOp : MERGE_MAIN)
      appendU32(ctx, schema.mainLen)
      ctx.lastMain = ctx.len
      appendZeros(ctx, schema.mainLen)
    }
    if (writeFixedValue(ctx, value, def, ctx.lastMain + def.start)) {
      return new ModifyError(def, value)
    }
  } else if (ctx.mergeMain) {
    ctx.mergeMain.push(def, value)
    ctx.mergeMainSize += def.len + 4
  } else {
    ctx.mergeMain = [def, value]
    ctx.mergeMainSize = def.len + 4
  }
}
