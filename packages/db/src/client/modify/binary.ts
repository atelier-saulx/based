import { BasedDb } from '../../index.js'
import { PropDef, SchemaTypeDef } from '../../server/schema/types.js'
import { UPDATE, ModifyOp, ModifyErr, RANGE_ERR, DELETE } from './types.js'
import { ModifyError } from './ModifyRes.js'
import { setCursor } from './setCursor.js'

export function getBuffer(value): Buffer {
  if (value instanceof Buffer) {
    return value
  }
  if (value && value.buffer instanceof ArrayBuffer) {
    return Buffer.from(value.buffer)
  }
}

export function writeBinary(
  value: any,
  ctx: BasedDb['modifyCtx'],
  schema: SchemaTypeDef,
  t: PropDef,
  parentId: number,
  modifyOp: ModifyOp,
): ModifyErr {
  let size: number
  if (value === null) {
    size = 0
  } else {
    value = getBuffer(value)
    if (!value) {
      return new ModifyError(t, value)
    }
    size = value.byteLength
  }
  if (size === 0) {
    if (modifyOp === UPDATE) {
      if (ctx.len + 11 > ctx.max) {
        return RANGE_ERR
      }

      setCursor(ctx, schema, t.prop, parentId, modifyOp)
      ctx.buf[ctx.len++] = DELETE
    }
  } else {
    if (ctx.len + 15 + size > ctx.max) {
      return RANGE_ERR
    }
    setCursor(ctx, schema, t.prop, parentId, modifyOp)
    ctx.buf[ctx.len++] = modifyOp
    ctx.buf[ctx.len++] = size
    ctx.buf[ctx.len++] = size >>>= 8
    ctx.buf[ctx.len++] = size >>>= 8
    ctx.buf[ctx.len++] = size >>>= 8
    ctx.buf.set(value, ctx.len)
    ctx.len += value.byteLength
  }
}
