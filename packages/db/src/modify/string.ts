import { BasedDb } from '../index.js'
import { flushBuffer } from '../operations.js'
import { SchemaTypeDef, PropDef } from '../schema/types.js'
import { CREATE, UPDATE, ModifyOp } from './types.js'
import { ModifyState, modifyError } from './ModifyRes.js'
import { setCursor } from './setCursor.js'

export function writeString(
  value: string | null,
  db: BasedDb,
  def: SchemaTypeDef,
  t: PropDef,
  res: ModifyState,
  modifyOp: ModifyOp,
) {
  if (typeof value !== 'string' && value !== null) {
    modifyError(res, t, value)
    return
  }

  const len = value?.length
  if (!len) {
    if (modifyOp === UPDATE) {
      if (db.modifyCtx.len + 11 > db.maxModifySize) {
        flushBuffer(db)
      }
      setCursor(db, def, t.prop, res.tmpId, modifyOp)
      db.modifyCtx.buffer[db.modifyCtx.len] = 11
      db.modifyCtx.len++
    }
  } else {
    if (modifyOp === CREATE) {
      def.stringPropsCurrent[t.prop] = 2
      db.modifyCtx.hasStringField++
    }
    const byteLen = len + len
    if (byteLen + 5 + db.modifyCtx.len + 11 > db.maxModifySize) {
      flushBuffer(db)
    }
    setCursor(db, def, t.prop, res.tmpId, modifyOp)
    db.modifyCtx.buffer[db.modifyCtx.len] = modifyOp
    db.modifyCtx.len += 5
    const size = db.modifyCtx.buffer.write(value, db.modifyCtx.len, 'utf8')
    db.modifyCtx.buffer.writeUint32LE(size, db.modifyCtx.len + 1 - 5)
    db.modifyCtx.len += size
  }
}
