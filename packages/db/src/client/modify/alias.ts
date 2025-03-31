import { ENCODER, ModifyCtx } from '../../index.js'
import { SchemaTypeDef, PropDef } from '@based/schema/def'
import {
  CREATE,
  UPDATE,
  ModifyOp,
  ModifyErr,
  RANGE_ERR,
  DELETE,
  SIZE,
} from './types.js'
import { ModifyError } from './ModifyRes.js'
import { setCursor } from './setCursor.js'

export function writeAlias(
  value: string | null,
  ctx: ModifyCtx,
  def: SchemaTypeDef,
  t: PropDef,
  parentId: number,
  modifyOp: ModifyOp,
): ModifyErr {
  if (typeof value === 'string') {
    if (value.length === 0) {
      if (modifyOp === UPDATE) {
        if (ctx.len + SIZE.DEFAULT_CURSOR > ctx.max) {
          return RANGE_ERR
        }
        setCursor(ctx, def, t.prop, t.typeIndex, parentId, modifyOp)
        ctx.buf[ctx.len++] = DELETE
      }
    } else {
      if (!t.validation(value, t)) {
        return new ModifyError(t, value)
      }
      const valueBuf = ENCODER.encode(value)
      let size = valueBuf.byteLength
      if (ctx.len + SIZE.DEFAULT_CURSOR + 5 + size > ctx.max) {
        // 5 compression size
        return RANGE_ERR
      }
      if (modifyOp === CREATE) {
        def.seperateSort.bufferTmp[t.prop] = 2
        ctx.hasSortField++
      }
      setCursor(ctx, def, t.prop, t.typeIndex, parentId, modifyOp)
      ctx.buf[ctx.len++] = modifyOp
      ctx.buf[ctx.len++] = size
      ctx.buf[ctx.len++] = size >>>= 8
      ctx.buf[ctx.len++] = size >>>= 8
      ctx.buf[ctx.len++] = size >>>= 8
      ctx.buf.set(valueBuf, ctx.len)
      ctx.len += valueBuf.byteLength
    }
  } else if (value === null) {
    if (modifyOp === UPDATE) {
      if (ctx.len + SIZE.DEFAULT_CURSOR + 1 > ctx.max) {
        return RANGE_ERR
      }
      setCursor(ctx, def, t.prop, t.typeIndex, parentId, modifyOp)
      ctx.buf[ctx.len++] = DELETE
    }
  } else {
    return new ModifyError(t, value)
  }
}
