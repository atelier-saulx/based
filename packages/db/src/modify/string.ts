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
import { appendU8, outOfRange } from './utils.js'
import { write } from '../string.js'

// allow setting buffer in modify create for strings
// add compression handling for main buffer
// add compression handling for edge fields
export function writeString(
  value: string | null | Buffer,
  ctx: BasedDb['modifyCtx'],
  def: SchemaTypeDef,
  t: PropDef,
  res: ModifyState,
  modifyOp: ModifyOp,
): ModifyErr {
  const isBuffer = value instanceof Buffer
  if (typeof value !== 'string' && value !== null && !isBuffer) {
    return new ModifyError(t, value)
  }
  const len = value?.length
  if (!len) {
    if (modifyOp === UPDATE) {
      if (outOfRange(ctx, 11)) {
        return RANGE_ERR
      }
      setCursor(ctx, def, t.prop, res.tmpId, modifyOp)
      appendU8(ctx, DELETE)
    }
  } else {
    let size = isBuffer ? value.byteLength : Buffer.byteLength(value, 'utf8')
    if (outOfRange(ctx, 15 + size + 5)) {
      // 5 compression size
      return RANGE_ERR
    }
    if (modifyOp === CREATE) {
      def.stringPropsCurrent[t.prop] = 2
      ctx.hasStringField++
    }
    setCursor(ctx, def, t.prop, res.tmpId, modifyOp)
    ctx.buf[ctx.len] = modifyOp
    ctx.len += 5
    if (isBuffer) {
      ctx.buf.set(value, ctx.len)
    } else {
      size = write(ctx.buf, value, ctx.len, ctx.db.noCompression)
    }
    ctx.buf.writeUint32LE(size, ctx.len + 1 - 5)
    ctx.len += size
  }
}
