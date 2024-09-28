import { BasedDb } from '../index.js'
import { flushBuffer } from '../operations.js'
import { SchemaTypeDef, PropDef } from '../schema/types.js'
import { ModifyState, modifyError } from './ModifyRes.js'
import { setCursor } from './setCursor.js'

export function writeString(
  value: string | null,
  fromCreate: boolean,
  db: BasedDb,
  def: SchemaTypeDef,
  t: PropDef,
  res: ModifyState,
  writeKey: 3 | 6,
) {
  if (typeof value !== 'string' && value !== null) {
    modifyError(res, t, value)
    return
  }

  const len = value?.length
  if (!len) {
    if (!fromCreate) {
      if (db.modifyBuffer.len + 11 > db.maxModifySize) {
        flushBuffer(db)
      }
      setCursor(db, def, t.prop, res.tmpId, false, fromCreate)
      db.modifyBuffer.buffer[db.modifyBuffer.len] = 11
      db.modifyBuffer.len++
    }
  } else {
    if (fromCreate) {
      def.stringPropsCurrent[t.prop] = 2
      db.modifyBuffer.hasStringField++
    }
    const byteLen = len + len
    if (byteLen + 5 + db.modifyBuffer.len + 11 > db.maxModifySize) {
      flushBuffer(db)
    }
    setCursor(db, def, t.prop, res.tmpId, false, fromCreate)
    db.modifyBuffer.buffer[db.modifyBuffer.len] = writeKey
    db.modifyBuffer.len += 5
    const size = db.modifyBuffer.buffer.write(
      value,
      db.modifyBuffer.len,
      'utf8',
    )
    db.modifyBuffer.buffer.writeUint32LE(size, db.modifyBuffer.len + 1 - 5)
    db.modifyBuffer.len += size
  }
}
