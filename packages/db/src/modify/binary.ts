import { BasedDb } from '../index.js'
import { flushBuffer } from '../operations.js'
import { SchemaTypeDef, PropDef } from '../schema/types.js'
import { CREATE, UPDATE, ModifyOp } from './types.js'
import { ModifyState, modifyError } from './ModifyRes.js'
import { setCursor } from './setCursor.js'
import { buffer } from 'stream/consumers'

export function writeBinary(
  value: Buffer | null,
  ctx: BasedDb['modifyCtx'],
  def: SchemaTypeDef,
  t: PropDef,
  res: ModifyState,
  modifyOp: ModifyOp,
) {
  if (!(value instanceof Buffer) && value !== null) {
    // @ts-ignore
    if (value && value.buffer instanceof ArrayBuffer) {
      // @ts-ignore
      value = Buffer.from(value.buffer)
    } else {
      modifyError(res, t, value)
      return
    }
  }
  const byteLen = value?.byteLength
  if (!byteLen) {
    if (modifyOp === UPDATE) {
      if (ctx.len + 11 > ctx.max) {
        flushBuffer(ctx.db)
      }
      setCursor(ctx, def, t.prop, res.tmpId, modifyOp)
      ctx.buf[ctx.len] = 11
      ctx.len++
    }
  } else {
    if (byteLen + 5 + ctx.len + 11 > ctx.max) {
      flushBuffer(ctx.db)
    }
    setCursor(ctx, def, t.prop, res.tmpId, modifyOp)
    ctx.buf[ctx.len] = modifyOp
    ctx.len += 5
    ctx.buf.set(value, ctx.len)
    ctx.buf.writeUint32LE(byteLen, ctx.len + 1 - 5)
    ctx.len += byteLen
  }
}
