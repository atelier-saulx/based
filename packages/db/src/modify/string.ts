import { BasedDb } from '../index.js'
import { SchemaTypeDef, PropDef } from '../schema/types.js'
import {
  CREATE,
  UPDATE,
  ModifyOp,
  ModifyErr,
  RANGE_ERR,
  DELETE,
} from './types.js'
import { ModifyError, ModifyState } from './ModifyRes.js'
import { setCursor } from './setCursor.js'
import {
  appendU32,
  appendU8,
  appendUtf8,
  reserveU32,
  writeU32,
} from './utils.js'
import { write } from '../string.js'

// allow setting buffer in modify create for strings
// add compression handling for main buffer
// add compression handling for edge fields
export function writeString(
  value: string | null,
  ctx: BasedDb['modifyCtx'],
  def: SchemaTypeDef,
  t: PropDef,
  res: ModifyState,
  modifyOp: ModifyOp,
): ModifyErr {
  if (typeof value !== 'string' && value !== null) {
    return new ModifyError(t, value)
  }
  const len = value?.length
  if (!len) {
    if (modifyOp === UPDATE) {
      if (ctx.len + 11 > ctx.max) {
        return RANGE_ERR
      }
      setCursor(ctx, def, t.prop, res.tmpId, modifyOp)
      appendU8(ctx, DELETE)
    }
  } else {
    const size = Buffer.byteLength(value, 'utf8')
    if (ctx.len + 11 + 4 + size > ctx.max) {
      return RANGE_ERR
    }
    if (modifyOp === CREATE) {
      def.stringPropsCurrent[t.prop] = 2
      ctx.hasStringField++
    }
    setCursor(ctx, def, t.prop, res.tmpId, modifyOp)

    appendU8(ctx, modifyOp)
    const sizepos = reserveU32(ctx)
    const newsize = appendUtf8(ctx, value)
    writeU32(ctx, newsize, sizepos)
  }
}
