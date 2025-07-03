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
import { convertToTimestamp } from '@saulx/utils'
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
  if (!def.validation(val, def)) {
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
  const valBuf = ENCODER.encode(val)
  const size = valBuf.byteLength
  if (size + 1 > def.len) {
    return new ModifyError(def, val, `max length of ${def.len - 1},`)
  }
  if (!def.validation(val, def)) {
    return new ModifyError(def, val)
  }
  if (ctx.len + size + 1 > ctx.max) {
    return RANGE_ERR
  }
  ctx.buf[ctx.len++] = size
  ctx.buf.set(valBuf, ctx.len)
  const fullSize = def.len - 1
  ctx.len += fullSize
  if (fullSize !== size) {
    ctx.buf.fill(0, ctx.len - (fullSize - size), ctx.len)
  }
}

map[BOOLEAN] = (ctx, val, def) => {
  if (ctx.len + 1 > ctx.max) {
    return RANGE_ERR
  }
  if (val === null) {
    val = def.default
  }
  if (!def.validation(val, def)) {
    return new ModifyError(def, val)
  }
  if (typeof val === 'boolean') {
    ctx.buf[ctx.len++] = val ? 1 : 0
  } else {
    return new ModifyError(def, val)
  }
}

map[ENUM] = (ctx, val, def) => {
  if (ctx.len + 1 > ctx.max) {
    return RANGE_ERR
  }
  if (!def.validation(val, def)) {
    return new ModifyError(def, val)
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
  if (ctx.len + 8 > ctx.max) {
    return RANGE_ERR
  }
  if (val === null) {
    val = def.default
  }

  if (!def.validation(val, def)) {
    return new ModifyError(def, val)
  }
  const view = new DataView(ctx.buf.buffer, ctx.buf.byteOffset + ctx.len, 8)
  ctx.len += 8
  view.setFloat64(0, val, true)
}

map[TIMESTAMP] = (ctx, val, def) => {
  const parsedValue = convertToTimestamp(val)
  if (ctx.len + 8 > ctx.max) {
    return RANGE_ERR
  }
  if (val === null) {
    val = def.default
  }
  if (!def.validation(parsedValue, def)) {
    return new ModifyError(def, val)
  }
  const view = new DataView(ctx.buf.buffer, ctx.buf.byteOffset + ctx.len, 8)
  ctx.len += 8
  // Todo use new utils and store as uint64
  view.setFloat64(0, parsedValue, true)
  // const ts = view.getFloat64(0)
}

map[UINT32] = (ctx, val, def) => {
  if (ctx.len + 4 > ctx.max) {
    return RANGE_ERR
  }
  if (val === null) {
    val = def.default
  }
  if (!def.validation(val, def)) {
    return new ModifyError(def, val)
  }
  ctx.buf[ctx.len++] = val
  ctx.buf[ctx.len++] = val >>>= 8
  ctx.buf[ctx.len++] = val >>>= 8
  ctx.buf[ctx.len++] = val >>>= 8
}

map[UINT16] = (ctx, val, def) => {
  if (ctx.len + 2 > ctx.max) {
    return RANGE_ERR
  }
  if (val === null) {
    val = def.default
  }
  if (!def.validation(val, def)) {
    return new ModifyError(def, val)
  }
  ctx.buf[ctx.len++] = val
  ctx.buf[ctx.len++] = val >>>= 8
}

map[UINT8] = (ctx, val, def) => {
  if (ctx.len + 1 > ctx.max) {
    return RANGE_ERR
  }
  if (val === null) {
    val = def.default
  }
  if (!def.validation(val, def)) {
    return new ModifyError(def, val)
  }
  ctx.buf[ctx.len++] = val
}

map[INT32] = (ctx, val, def) => {
  if (ctx.len + 4 > ctx.max) {
    return RANGE_ERR
  }
  if (val === null) {
    val = def.default
  }
  if (!def.validation(val, def)) {
    return new ModifyError(def, val)
  }
  ctx.buf[ctx.len++] = val
  ctx.buf[ctx.len++] = val >>>= 8
  ctx.buf[ctx.len++] = val >>>= 8
  ctx.buf[ctx.len++] = val >>>= 8
}

map[INT16] = (ctx, val, def) => {
  if (ctx.len + 2 > ctx.max) {
    return RANGE_ERR
  }
  if (val === null) {
    val = def.default
  }
  if (!def.validation(val, def)) {
    return new ModifyError(def, val)
  }
  ctx.buf[ctx.len++] = val
  ctx.buf[ctx.len++] = val >>>= 8
}

map[INT8] = (ctx, val, def) => {
  if (ctx.len + 1 > ctx.max) {
    return RANGE_ERR
  }
  if (val === null) {
    val = def.default
  }
  if (!def.validation(val, def)) {
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
