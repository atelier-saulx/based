import { ModifyCtx } from '../../index.js'
import { SchemaTypeDef, PropDef } from '../../server/schema/types.js'
import { ModifyOp, ModifyErr, UPDATE, RANGE_ERR, DELETE } from './types.js'
import { ModifyError } from './ModifyRes.js'
import { setCursor } from './setCursor.js'
import { xxHash64 } from '../xxHash64.js'

export function writeHll(
  value: string | null | Buffer,
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
    return addHll(value, ctx, def, t, parentId, modifyOp)
  }
}

function addHll(
  value: string | null | Buffer,
  ctx: ModifyCtx,
  def: SchemaTypeDef,
  t: PropDef,
  parentId: number,
  modifyOp: ModifyOp,
): ModifyErr {
  let size = 8

  if (ctx.len + size + 11 > ctx.max) {
    return RANGE_ERR
  }

  // console.log(`test JS original value = ${value}`)
  setCursor(ctx, def, t.prop, t.typeIndex, parentId, modifyOp)
  ctx.buf[ctx.len++] = modifyOp

  let hash: bigint = xxHash64(Buffer.from(value)) //1ec6c662633f0026 or 2217677992400715814

  ctx.buf.writeBigUInt64LE(hash, ctx.len)
  // console.log('js hash:', hash)
  ctx.len += 8
}
