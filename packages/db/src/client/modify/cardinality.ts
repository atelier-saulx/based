import { ModifyCtx } from '../../index.js'
import { SchemaTypeDef, PropDef, PropDefEdge } from '@based/schema/def'
import { ModifyOp, ModifyErr, RANGE_ERR, CREATE, SIZE } from './types.js'
import { ModifyError } from './ModifyRes.js'
import { setCursor } from './setCursor.js'
import { xxHash64 } from '../xxHash64.js'
import { ENCODER } from '@based/utils'

export function writeHll(
  value: string | null | Uint8Array | Array<string | Uint8Array>,
  ctx: ModifyCtx,
  def: SchemaTypeDef,
  t: PropDef,
  parentId: number,
  modifyOp: ModifyOp,
): ModifyErr {
  if (!value) {
    return new ModifyError(t, value)
  }
  if (value === null) {
    // Future hll_reset function
    return
  } else if (!Array.isArray(value)) {
    value = [value]
  }
  const err = addHll(value, ctx, def, t, parentId, modifyOp)
  if (!err && modifyOp === CREATE) {
    def.seperateSort.bufferTmp[t.prop] = 2
    ctx.hasSortField++
  }

  return err
}

function addHll(
  value: (string | Uint8Array)[],
  ctx: ModifyCtx,
  def: SchemaTypeDef,
  t: PropDef,
  parentId: number,
  modifyOp: ModifyOp,
): ModifyErr {
  const len = value.length
  let size = 4 + len * 8
  if (ctx.len + size + SIZE.DEFAULT_CURSOR > ctx.max) {
    return RANGE_ERR
  }
  setCursor(ctx, def, t.prop, t.typeIndex, parentId, modifyOp)
  ctx.buf[ctx.len++] = modifyOp
  return writeHllBuf(value, ctx, t, len)
}

export function writeHllBuf(
  value: (string | Uint8Array)[],
  ctx: ModifyCtx,
  t: PropDef | PropDefEdge,
  len: number,
) {
  let startLen = ctx.len
  ctx.buf[ctx.len++] = len
  ctx.buf[ctx.len++] = len >>> 8
  ctx.buf[ctx.len++] = len >>> 16
  ctx.buf[ctx.len++] = len >>> 24
  for (let val of value) {
    if (val === undefined) {
      // not sure if this makes sense....
      continue
    } else if (!t.validation(val, t)) {
      ctx.len = startLen
      len = 0
      ctx.buf[ctx.len++] = len
      ctx.buf[ctx.len++] = len >>> 8
      ctx.buf[ctx.len++] = len >>> 16
      ctx.buf[ctx.len++] = len >>> 24
      return new ModifyError(t, val)
    } else if (typeof val === 'string') {
      xxHash64(ENCODER.encode(val), ctx.buf, ctx.len)
    } else if (val instanceof Uint8Array && val.byteLength === 8) {
      ctx.buf.set(val, ctx.len)
    }
    ctx.len += 8
  }
}
