import { ModifyCtx } from '../../index.js'
import { SchemaTypeDef, PropDef } from '../../server/schema/types.js'
import {
  CREATE,
  UPDATE,
  ModifyOp,
  ModifyErr,
  RANGE_ERR,
  DELETE,
} from './types.js'
import { ModifyError } from './ModifyRes.js'
import { setCursor } from './setCursor.js'

export function writeAlias(
  value: string | null | Buffer,
  ctx: ModifyCtx,
  def: SchemaTypeDef,
  t: PropDef,
  parentId: number,
  modifyOp: ModifyOp,
): ModifyErr {
  if (typeof value === 'string') {
    if (value.length === 0) {
      if (modifyOp === UPDATE) {
        if (ctx.len + 11 > ctx.max) {
          return RANGE_ERR
        }
        setCursor(ctx, def, t.prop, t.typeIndex, parentId, modifyOp)
        ctx.buf[ctx.len++] = DELETE
      }
    } else {
      let size = Buffer.byteLength(value, 'utf8')
      if (ctx.len + 15 + size > ctx.max) {
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
      ctx.len += ctx.buf.write(value, ctx.len, 'utf8')
    }
  } else if (value === null) {
    if (modifyOp === UPDATE) {
      if (ctx.len + 11 > ctx.max) {
        return RANGE_ERR
      }
      setCursor(ctx, def, t.prop, t.typeIndex, parentId, modifyOp)
      ctx.buf[ctx.len++] = DELETE
    }
  } else {
    return new ModifyError(t, value)
  }
}
