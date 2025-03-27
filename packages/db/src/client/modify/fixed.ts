import { ENCODER, ModifyCtx } from '../../index.js'
import {
  BINARY,
  BOOLEAN,
  ENUM,
  INT16,
  INT32,
  INT8,
  NUMBER,
  PropDef,
  PropDefEdge,
  STRING,
  TIMESTAMP,
  UINT16,
  UINT32,
  UINT8,
} from '@based/schema/def'
import { convertToTimestamp } from '../timestamp.js'
import { getBuffer } from './binary.js'
import { ModifyError } from './ModifyRes.js'
import { ModifyErr, RANGE_ERR } from './types.js'

const map: Record<
  number,
  (ctx: ModifyCtx, val: any, def: PropDef | PropDefEdge) => ModifyErr
> = {}

map[BINARY] = (ctx, val, def) => {
  const buf = getBuffer(val)
  if (buf === undefined) {
    return new ModifyError(def, val)
  }
  const size = buf.byteLength
  if (ctx.len + size + 1 > ctx.max) {
    return RANGE_ERR
  }
  ctx.buf[ctx.len++] = size
  ctx.buf.set(buf, ctx.len)
  ctx.len += buf.byteLength
}

map[STRING] = (ctx, val, def) => {
  if (typeof val !== 'string') {
    if (val !== null) {
      return new ModifyError(def, val)
    }
    val = ''
  }
  const valBuf = ENCODER.encode(val)
  const size = valBuf.byteLength
  if (size + 1 > def.len) {
    return new ModifyError(def, val, `max length of ${def.len - 1},`)
  }
  if (ctx.len + size + 1 > ctx.max) {
    return RANGE_ERR
  }
  ctx.buf[ctx.len++] = size
  ctx.buf.set(valBuf, ctx.len)
  ctx.len += size
}

map[BOOLEAN] = (ctx, val, def) => {
  if (ctx.len + 1 > ctx.max) {
    return RANGE_ERR
  }
  if (val === null) {
    ctx.buf[ctx.len++] = 0
  } else if (typeof val === 'boolean') {
    ctx.buf[ctx.len++] = val ? 1 : 0
  } else {
    return new ModifyError(def, val)
  }
}

map[ENUM] = (ctx, val, def) => {
  if (ctx.len + 1 > ctx.max) {
    return RANGE_ERR
  }
  if (val === null) {
    ctx.buf[ctx.len++] = 0
  } else if (val in def.reverseEnum) {
    ctx.buf[ctx.len++] = def.reverseEnum[val] + 1
  } else {
    return new ModifyError(def, val)
  }
}

map[NUMBER] = (ctx, val, def) => {
  if (typeof val !== 'number') {
    return new ModifyError(def, val)
  }
  if (ctx.len + 8 > ctx.max) {
    return RANGE_ERR
  }
  const view = new DataView(ctx.buf.buffer, ctx.buf.byteOffset + ctx.len, 8)
  ctx.len += 8
  view.setFloat64(0, val, true)
}

map[TIMESTAMP] = (ctx, val, def) => {
  const parsedValue = convertToTimestamp(val)
  if (typeof parsedValue !== 'number') {
    return new ModifyError(def, val)
  }
  if (ctx.len + 8 > ctx.max) {
    return RANGE_ERR
  }
  if (val < 0) {
    return new ModifyError(def, val)
  }
  const view = new DataView(ctx.buf.buffer, ctx.buf.byteOffset + ctx.len, 8)
  ctx.len += 8
  view.setFloat64(0, parsedValue, true)
}

map[UINT32] = (ctx, val, def) => {
  if (typeof val !== 'number') {
    return new ModifyError(def, val)
  }
  if (val > 4294967295 || val < 0) {
    return new ModifyError(def, val)
  }
  if (ctx.len + 4 > ctx.max) {
    return RANGE_ERR
  }
  ctx.buf[ctx.len++] = val
  ctx.buf[ctx.len++] = val >>>= 8
  ctx.buf[ctx.len++] = val >>>= 8
  ctx.buf[ctx.len++] = val >>>= 8
}

map[UINT16] = (ctx, val, def) => {
  if (typeof val !== 'number') {
    return new ModifyError(def, val)
  }
  if (val > 65535 || val < 0) {
    return new ModifyError(def, val)
  }
  if (ctx.len + 2 > ctx.max) {
    return RANGE_ERR
  }
  ctx.buf[ctx.len++] = val
  ctx.buf[ctx.len++] = val >>>= 8
}

map[UINT8] = (ctx, val, def) => {
  if (typeof val !== 'number') {
    return new ModifyError(def, val)
  }
  if (ctx.len + 1 > ctx.max) {
    return RANGE_ERR
  }
  if (val > 255 || val < 0) {
    return new ModifyError(def, val)
  }
  ctx.buf[ctx.len++] = val
}

map[INT32] = (ctx, val, def) => {
  if (typeof val !== 'number') {
    return new ModifyError(def, val)
  }
  if (val > 2147483647 || val < -2147483648) {
    return new ModifyError(def, val)
  }
  if (ctx.len + 4 > ctx.max) {
    return RANGE_ERR
  }
  ctx.buf[ctx.len++] = val
  ctx.buf[ctx.len++] = val >>>= 8
  ctx.buf[ctx.len++] = val >>>= 8
  ctx.buf[ctx.len++] = val >>>= 8
}

map[INT16] = (ctx, val, def) => {
  if (typeof val !== 'number') {
    return new ModifyError(def, val)
  }
  if (ctx.len + 2 > ctx.max) {
    return RANGE_ERR
  }
  if (val > 32767 || val < -32768) {
    return new ModifyError(def, val)
  }
  ctx.buf[ctx.len++] = val
  ctx.buf[ctx.len++] = val >>>= 8
}

map[INT8] = (ctx, val, def) => {
  if (typeof val !== 'number') {
    return new ModifyError(def, val)
  }
  if (ctx.len + 1 > ctx.max) {
    return RANGE_ERR
  }
  if (val > 127 || val < -128) {
    return new ModifyError(def, val)
  }
  ctx.buf[ctx.len++] = val
}

export const writeFixedValue = (
  ctx: ModifyCtx,
  val: any,
  def: PropDef | PropDefEdge,
  pos: number,
): ModifyErr => {
  const len = ctx.len
  ctx.len = pos
  const res = map[def.typeIndex](ctx, val, def)
  ctx.len = len
  return res
}

export const appendFixedValue = (
  ctx: ModifyCtx,
  val: any,
  def: PropDef | PropDefEdge,
): ModifyErr => {
  return map[def.typeIndex](ctx, val, def)
}
