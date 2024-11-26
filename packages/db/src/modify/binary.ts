import { BasedDb } from '../index.js'
import { SchemaTypeDef, PropDef } from '../schema/types.js'
import { UPDATE, ModifyOp, ModifyErr, RANGE_ERR, DELETE } from './types.js'
import { ModifyError, ModifyState } from './ModifyRes.js'
import { setCursor } from './setCursor.js'
import { appendBuf, appendU32, appendU8, outOfRange } from './utils.js'

export function getBuffer(value): Buffer {
  if (value instanceof Buffer) {
    return value
  }
  if (value && value.buffer instanceof ArrayBuffer) {
    return Buffer.from(value.buffer)
  }
}

export function writeBinary(
  value: any,
  ctx: BasedDb['modifyCtx'],
  def: SchemaTypeDef,
  t: PropDef,
  res: ModifyState,
  modifyOp: ModifyOp,
): ModifyErr {
  let size: number
  if (value === null) {
    size = 0
  } else {
    value = getBuffer(value)
    if (!value) {
      return new ModifyError(t, value)
    }
    size = value.byteLength
  }
  if (size === 0) {
    if (modifyOp === UPDATE) {
      if (outOfRange(ctx, 11)) {
        return RANGE_ERR
      }
      setCursor(ctx, def, t.prop, res.tmpId, modifyOp)
      appendU8(ctx, DELETE)
    }
  } else {
    if (outOfRange(ctx, 15 + size)) {
      return RANGE_ERR
    }
    setCursor(ctx, def, t.prop, res.tmpId, modifyOp)
    appendU8(ctx, modifyOp)
    appendU32(ctx, size)
    appendBuf(ctx, value)
  }
}
