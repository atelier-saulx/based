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
  let size = Math.min(value.byteLength, fieldSize)
  let padding = 0

  if (ctx.len % 4 != 0) {
    padding = ctx.len % 4
  }

  size -= padding
  let tmp = size + 4

  // 16-bits would be enough but the zig expects 32-bits
  ctx.buf[ctx.len++] = tmp
  ctx.buf[ctx.len++] = tmp >>>= 8
  ctx.buf[ctx.len++] = tmp >>>= 8
  ctx.buf[ctx.len++] = tmp >>>= 8

  ctx.buf[ctx.len++] = padding
  ctx.buf[ctx.len++] = 0
  ctx.buf[ctx.len++] = 0
  ctx.buf[ctx.len++] = 0

  ctx.buf.set(new Uint8Array(value.buffer).subarray(0, size), ctx.len - padding)
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
    size = value.byteLength + 4
  }
  if (!t.validation(value, t)) {
    return new ModifyError(t, value)
  }
  if (size === 0) {
    if (modifyOp === UPDATE) {
      if (ctx.len + SIZE.DEFAULT_CURSOR + 1 > ctx.max) {
        return RANGE_ERR
      }
      setCursor(ctx, schema, t.prop, t.typeIndex, parentId, modifyOp)
      ctx.buf[ctx.len++] = DELETE
    }
  } else {
    if (ctx.len + SIZE.DEFAULT_CURSOR + 5 + size > ctx.max) {
      return RANGE_ERR
    }
    setCursor(ctx, schema, t.prop, t.typeIndex, parentId, modifyOp)
    ctx.buf[ctx.len++] = modifyOp
    write(value, ctx, t.len)
  }
}
