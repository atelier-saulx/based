import { ModifyCtx } from '../../index.js'
import { PropDef, SchemaTypeDef } from '@based/schema/def'
import {
  UPDATE,
  ModifyOp,
  ModifyErr,
  RANGE_ERR,
  DELETE,
  SIZE,
} from './types.js'
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
  ctx.buf.set(new Uint8Array(value.buffer).subarray(0, size), ctx.len)
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
      if (ctx.len + SIZE.DEFAULT_CURSOR + 1 > ctx.max) {
        // TODO ???
        return RANGE_ERR
      }

      setCursor(ctx, schema, t.prop, t.typeIndex, parentId, modifyOp)
      ctx.buf[ctx.len++] = DELETE
    }
  } else {
    if (ctx.len + SIZE.DEFAULT_CURSOR + 5 + size > ctx.max) {
      // TODO ???
      return RANGE_ERR
    }
    setCursor(ctx, schema, t.prop, t.typeIndex, parentId, modifyOp)
    ctx.buf[ctx.len++] = modifyOp
    write(value, ctx, t.len)
  }
}
