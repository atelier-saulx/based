import { ModifyCtx } from '../../index.js'
import { SchemaTypeDef, PropDef } from '../../server/schema/types.js'
import { ModifyOp, ModifyErr, UPDATE, RANGE_ERR, DELETE } from './types.js'
import { ModifyError } from './ModifyRes.js'
import { setCursor } from './setCursor.js'
import { crc32 } from '../crc32.js'

export function writeHll(
  value: string | null | Buffer,
  ctx: ModifyCtx,
  def: SchemaTypeDef,
  t: PropDef,
  parentId: number,
  modifyOp: ModifyOp,
): ModifyErr {
  console.log(`writeHll: value = ${value}`)
  if (typeof value !== 'string') {
    return new ModifyError(t, value)
  }

  if (value === null) {
    // console.log('modify/cardinality.ts trying to reset?')
    // if (modifyOp === UPDATE) {
    //   if (ctx.len + 11 > ctx.max) {
    //     return RANGE_ERR
    //   }
    //   setCursor(ctx, def, t.prop, parentId, modifyOp)
    //   ctx.buf[ctx.len++] = DELETE
    // }
  } else if (Array.isArray(value)) {
    // console.log('modify/cardinality.ts Array.isArray(value)')
    // for (const key in value) {
    //   if (key === 'add') {
    //     // @ts-ignore
    //     const err = addHll(value[key], ctx, def, t, parentId, modifyOp, 1)
    //     if (err) {
    //       return err
    //     }
    //   } else {
    //     return new ModifyError(t, value)
    //   }
    // }
  } else {
    // hllAdd
    console.log('modify/cardinality.ts init + add')
    return addHll(value, ctx, def, t, parentId, modifyOp, 0)
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
  console.log(`addHll: value = ${value}`)
  let size = value.length * 4 + 1

  if (ctx.len + size + 11 > ctx.max) {
    return RANGE_ERR
  }

  console.log(`cardinality.ts value = ${value}`)
  setCursor(ctx, def, t.prop, parentId, modifyOp)
  ctx.buf[ctx.len++] = modifyOp
  ctx.buf[ctx.len++] = size
  ctx.buf[ctx.len++] = size >>>= 8
  ctx.buf[ctx.len++] = size >>>= 8
  ctx.buf[ctx.len++] = size >>>= 8
  ctx.buf[ctx.len++] = addOrPut
  for (const str of value) {
    if (typeof str !== 'string') {
      return new ModifyError(t, value)
    }
    // CALL XX
    let hash = crc32(Buffer.from(str))
    console.log(`cardinality.ts str = ${str}`)
    console.log(`hash = ${hash}`)
    ctx.buf[ctx.len++] = hash
    ctx.buf[ctx.len++] = hash >>>= 8
    ctx.buf[ctx.len++] = hash >>>= 8
    ctx.buf[ctx.len++] = hash >>>= 8
  }
}
