import { BasedDb } from '../index.js'
import { SchemaTypeDef, PropDef } from '../schema/types.js'
import { CREATE, UPDATE, ModifyOp } from './types.js'
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
  if (!len) {
    if (modifyOp === UPDATE) {
      maybeFlush(db, 11)
      db.modifyCtx.buffer[db.modifyCtx.len] = 11
      db.modifyCtx.len++
    }
  } else {
    if (modifyOp === CREATE) {
      def.stringPropsCurrent[propDef.prop] = 2
      db.modifyCtx.hasStringField++
    }
    const byteLen = len + len
    maybeFlush(db, byteLen + 5 + 11)
    db.modifyCtx.buffer[db.modifyCtx.len] = modifyOp
    db.modifyCtx.len += 5
    const size = db.modifyCtx.buffer.write(value, db.modifyCtx.len, 'utf8')
    db.modifyCtx.buffer.writeUint32LE(size, db.modifyCtx.len + 1 - 5)
    db.modifyCtx.len += size
  }
}
