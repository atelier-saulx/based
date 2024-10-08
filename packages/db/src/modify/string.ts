import { BasedDb } from '../index.js'
import { flushBuffer } from '../operations.js'
import { SchemaTypeDef, PropDef } from '../schema/types.js'
import { CREATE, UPDATE, ModifyOp } from './types.js'
import { ModifyState, modifyError } from './ModifyRes.js'
import { setCursor } from './setCursor.js'

export function writeString(
  value: string | null,
  ctx: BasedDb['modifyCtx'],
  def: SchemaTypeDef,
  t: PropDef,
  res: ModifyState,
  modifyOp: ModifyOp,
) {
  if (typeof value !== 'string' && value !== null) {
    modifyError(res, t, value)
    return
  }

  const len = value?.length
  if (!len) {
    if (modifyOp === UPDATE) {
      if (ctx.len + 11 > ctx.max) {
        flushBuffer(ctx.db)
      }
      setCursor(ctx, def, t.prop, res.tmpId, modifyOp)
      ctx.buf[ctx.len] = 11
      ctx.len++
    }
  } else {
    if (modifyOp === CREATE) {
      def.stringPropsCurrent[t.prop] = 2
      ctx.hasStringField++
    }
    const byteLen = len + len
    if (byteLen + 5 + ctx.len + 11 > ctx.max) {
      flushBuffer(ctx.db)
    }
    setCursor(ctx, def, t.prop, res.tmpId, modifyOp)
    ctx.buf[ctx.len] = modifyOp
    ctx.len += 5
    const size = ctx.buf.write(value, ctx.len, 'utf8')
    ctx.buf.writeUint32LE(size, ctx.len + 1 - 5)
    ctx.len += size
  }
}
