import { ModifyCtx } from '../../index.js'
import { ENCODER } from '../../utils.js'
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
import native from '../../native.js'

export function getBuffer(value: any): Uint8Array | undefined {
  if (typeof value === 'object') {
    if (value instanceof Uint8Array) {
      return value
    }
    if (value.buffer instanceof ArrayBuffer) {
      return new Uint8Array(value.buffer, 0, value.byteLength)
    }
  } else if (typeof value === 'string') {
    return ENCODER.encode(value)
  }
}

export function writeBinaryRaw(value: Uint8Array, ctx: ModifyCtx) {
  let size = value.byteLength + 6
  let crc = native.crc32(value)

  ctx.buf[ctx.len++] = size
  ctx.buf[ctx.len++] = size >>>= 8
  ctx.buf[ctx.len++] = size >>>= 8
  ctx.buf[ctx.len++] = size >>>= 8
  ctx.buf[ctx.len++] = 0
  ctx.buf[ctx.len++] = 0
  ctx.buf.set(value, ctx.len)
  ctx.len += value.byteLength
  ctx.buf[ctx.len++] = crc
  ctx.buf[ctx.len++] = crc >>>= 8
  ctx.buf[ctx.len++] = crc >>>= 8
  ctx.buf[ctx.len++] = crc >>>= 8
}

export function writeBinary(
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
    value = getBuffer(value)
    if (!value || !t.validation(value, t)) {
      return new ModifyError(t, value)
    }
    size = value.byteLength + 6
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
    writeBinaryRaw(value, ctx)
  }
}
