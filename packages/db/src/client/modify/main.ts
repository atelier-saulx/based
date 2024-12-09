import { BasedDb } from '../../index.js'
import { ModifyOp, MERGE_MAIN, ModifyErr, RANGE_ERR } from './types.js'
import { ModifyError } from './ModifyRes.js'
import { setCursor } from './setCursor.js'
import { writeFixedValue } from './utils.js'
import { PropDef } from '../../server/schema/types.js'

export function writeMain(
  value: string | null,
  ctx: BasedDb['modifyCtx'],
  mainLen: number,
  def: PropDef,
  parentId: number,
  modifyOp: ModifyOp,
  overwrite: boolean,
): ModifyErr {
  if (overwrite) {
    if (ctx.len + 15 + mainLen > ctx.max) {
      return RANGE_ERR
    }
    setCursor(ctx, def.prop, parentId, modifyOp, true)
    if (ctx.lastMain === -1) {
      let mainLenU32 = mainLen
      setCursor(ctx, def.prop, parentId, modifyOp)
      ctx.buf[ctx.len++] = overwrite ? modifyOp : MERGE_MAIN
      ctx.buf[ctx.len++] = mainLenU32
      ctx.buf[ctx.len++] = mainLenU32 >>>= 8
      ctx.buf[ctx.len++] = mainLenU32 >>>= 8
      ctx.buf[ctx.len++] = mainLenU32 >>>= 8
      ctx.lastMain = ctx.len
      ctx.buf.fill(0, ctx.len, (ctx.len += mainLen))
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
