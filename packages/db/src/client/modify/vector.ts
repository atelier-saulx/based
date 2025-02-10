import { ModifyCtx } from '../../index.js'
import { PropDef, SchemaTypeDef } from '../../server/schema/types.js'
import { UPDATE, ModifyOp, ModifyErr, RANGE_ERR, DELETE } from './types.js'
import { ModifyError } from './ModifyRes.js'
import { setCursor } from './setCursor.js'

function write(value: Float32Array, ctx: ModifyCtx, fieldSize: number) {
  const size = Math.min(value.byteLength, fieldSize)
  let tmp = size

  // 16-bits would be enough but the zig code now expects 32-bits
  ctx.buf[ctx.len++] = tmp
  ctx.buf[ctx.len++] = tmp >>>= 8
  ctx.buf[ctx.len++] = tmp >>>= 8
  ctx.buf[ctx.len++] = tmp >>>= 8
  Buffer.from(value.buffer).copy(ctx.buf, ctx.len, 0, size)
  ctx.len += size
}

export function writeVector(
  value: any,
  ctx: ModifyCtx,
  schema: SchemaTypeDef,
  t: PropDef,
  parentId: number,
  modifyOp: ModifyOp,
): ModifyErr {
  let size: number
  if (value === null) {
    size = 0
  } else {
    if (!value) {
      return new ModifyError(t, value)
    }
    size = value.byteLength + 4
  }
  if (size === 0) {
    if (modifyOp === UPDATE) {
      if (ctx.len + 11 > ctx.max) { // TODO ???
        return RANGE_ERR
      }

      setCursor(ctx, schema, t.prop, parentId, modifyOp)
      ctx.buf[ctx.len++] = DELETE
    }
  } else {
    if (ctx.len + 15 + size > ctx.max) { // TODO ???
      return RANGE_ERR
    }
    setCursor(ctx, schema, t.prop, parentId, modifyOp)
    ctx.buf[ctx.len++] = modifyOp
    write(value, ctx, t.len)
  }
}
