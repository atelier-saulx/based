import { ModifyCtx } from '../../index.js'
import { SchemaTypeDef, PropDef } from '../../server/schema/types.js'
import { ModifyOp, ModifyErr, UPDATE, RANGE_ERR, DELETE } from './types.js'
import { ModifyError } from './ModifyRes.js'
import { setCursor } from './setCursor.js'
import { xxHash64 } from '../xxHash64.js'

export function writeHll(
  value: string | null | Buffer | Array<string | Buffer>,
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
    // Future hll_reset frunction
    return
  } else if (!Array.isArray(value)) {
    value = [value]
  }

  const err = addHll(value, ctx, def, t, parentId, modifyOp)
}

function addHll(
  value: (string | Buffer)[],
  ctx: ModifyCtx,
  def: SchemaTypeDef,
  t: PropDef,
  parentId: number,
  modifyOp: ModifyOp,
): ModifyErr {
  const len = value.length
  let size = 2 + len * 8

  if (ctx.len + size + 11 > ctx.max) {
    return RANGE_ERR
  }

  setCursor(ctx, def, t.prop, t.typeIndex, parentId, modifyOp)
  ctx.buf[ctx.len++] = modifyOp
  ctx.buf.writeUint16LE(len, ctx.len)
  ctx.len += 2

  for (let val of value) {
    let b: Buffer
    if (typeof val === 'string') {
      b = Buffer.from(val)
    } else if (!(val instanceof Buffer)) {
      b = val
      return new ModifyError(t, val)
    }
    const hash: bigint = xxHash64(b)
    ctx.buf.writeBigUInt64LE(hash, ctx.len)
    ctx.len += 8
  }
}
