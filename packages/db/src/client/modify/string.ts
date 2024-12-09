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
import { write } from '../string.js'

// allow setting buffer in modify create for strings
// add compression handling for main buffer
// add compression handling for edge fields
export function writeString(
  value: string | null | Buffer,
  ctx: ModifyCtx,
  def: SchemaTypeDef,
  t: PropDef,
  parentId: number,
  modifyOp: ModifyOp,
): ModifyErr {
  const isBuffer = value instanceof Buffer
  if (typeof value !== 'string' && value !== null && !isBuffer) {
    return new ModifyError(t, value)
  }
  const len = value?.length
  if (!len) {
    if (modifyOp === UPDATE) {
      if (ctx.len + 11 > ctx.max) {
        return RANGE_ERR
      }
      setCursor(ctx, def, t.prop, parentId, modifyOp)
      ctx.buf[ctx.len++] = DELETE
    }
  } else {
    let size = isBuffer ? value.byteLength : Buffer.byteLength(value, 'utf8')
    if (ctx.len + 20 + size > ctx.max) {
      // 5 compression size
      return RANGE_ERR
    }
    if (modifyOp === CREATE) {
      def.stringPropsCurrent[t.prop] = 2
      ctx.hasStringField++
    }
    setCursor(ctx, def, t.prop, parentId, modifyOp)
    ctx.buf[ctx.len] = modifyOp
    ctx.len += 5
    if (isBuffer) {
      ctx.buf.set(value, ctx.len)
    } else {
      const isNoCompression = ctx.db.noCompression || t.compression === 0
      size = write(ctx.buf, value, ctx.len, isNoCompression)
    }
    // let sizepos = ctx.len + 1 - 5
    // ctx.buf[sizepos++] = size
    // ctx.buf[sizepos++] = size >>>= 8
    // ctx.buf[sizepos++] = size >>>= 8
    // ctx.buf[sizepos] = size >>>= 8
    ctx.buf.writeUint32LE(size, ctx.len + 1 - 5)
    ctx.len += size
  }
}
