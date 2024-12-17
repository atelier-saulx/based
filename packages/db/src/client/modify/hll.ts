import { ModifyCtx } from '../../index.js'
import { SchemaTypeDef, PropDef } from '../../server/schema/types.js'
import { ModifyOp, ModifyErr, UPDATE, RANGE_ERR, DELETE } from './types.js'
import { ModifyError } from './ModifyRes.js'
import { setCursor } from './setCursor.js'

export function writeHll(
  value: string | null | Buffer,
  ctx: ModifyCtx,
  def: SchemaTypeDef,
  t: PropDef,
  parentId: number,
  modifyOp: ModifyOp,
): ModifyErr {
  if (typeof value !== 'object') {
    return new ModifyError(t, value)
  }

  if (value === null) {
    if (modifyOp === UPDATE) {
      if (ctx.len + 11 > ctx.max) {
        return RANGE_ERR
      }
      setCursor(ctx, def, t.prop, parentId, modifyOp)
      ctx.buf[ctx.len++] = DELETE
    }
  } else if (Array.isArray(value)) {
    return addHll(value, ctx, def, t, parentId, modifyOp, 0)
  } else {
    for (const key in value) {
      if (key === 'add') {
        const err = addHll(value, ctx, def, t, parentId, modifyOp, 1)
        if (err) {
          return err
        }
      } else {
        return new ModifyError(t, value)
      }
    }
  }
}

function addHll(
  value: string | null | Buffer,
  ctx: ModifyCtx,
  def: SchemaTypeDef,
  t: PropDef,
  parentId: number,
  modifyOp: ModifyOp,
  addOrPut: 0 | 1,
): ModifyErr {
  let nullStr = ''
  for (const str of value) {
    if (typeof str !== 'string') {
      return new ModifyError(t, value)
    }
    nullStr += str + '\0'
  }
  let size = Buffer.byteLength(nullStr, 'utf8') + 1
  if (ctx.len + size + 11 > ctx.max) {
    return RANGE_ERR
  }

  setCursor(ctx, def, t.prop, parentId, modifyOp)
  ctx.buf[ctx.len++] = modifyOp
  ctx.buf[ctx.len++] = size
  ctx.buf[ctx.len++] = size >>>= 8
  ctx.buf[ctx.len++] = size >>>= 8
  ctx.buf[ctx.len++] = size >>>= 8
  ctx.buf[ctx.len++] = addOrPut
  ctx.buf.write(nullStr, 'utf-8')
}
