import { BasedDb } from '../index.js'
import { SchemaTypeDef, PropDef } from '../schema/types.js'
import { CREATE, UPDATE, ModifyOp, DELETE_FIELD } from './types.js'
import { ModifyState, modifyError } from './ModifyRes.js'
import { maybeFlush } from './utils.js'

export function writeString(
  value: string | null,
  db: BasedDb,
  def: SchemaTypeDef,
  propDef: PropDef,
  res: ModifyState,
  modifyOp: ModifyOp,
) {
  if (typeof value !== 'string' && value !== null) {
    modifyError(res, propDef, value)
    return
  }

  const len = value?.length
  const ctx = db.modifyCtx
  const buf = ctx.buffer
  if (!len) {
    if (modifyOp === UPDATE) {
      maybeFlush(db, 11)
      buf[ctx.len] = DELETE_FIELD
      ctx.len++
    }
  } else {
    if (modifyOp === CREATE) {
      def.stringPropsCurrent[propDef.prop] = 2
      ctx.hasStringField++
    }
    const byteLen = len + len
    maybeFlush(db, byteLen + 5 + 11)
    buf[ctx.len] = modifyOp
    ctx.len += 5
    const size = buf.write(value, ctx.len, 'utf8')
    buf.writeUint32LE(size, ctx.len + 1 - 5)
    ctx.len += size
  }
}
