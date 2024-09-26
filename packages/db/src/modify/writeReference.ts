import { BasedDb } from '../index.js'
import { flushBuffer } from '../operations.js'
import { SchemaTypeDef, PropDef } from '../schema/types.js'
import { setCursor } from './setCursor.js'

export function writeReference(
  value: any,
  db: BasedDb,
  schema: SchemaTypeDef,
  t: PropDef,
  id: number,
  fromCreate: boolean,
  writeKey: number,
) {
  if (value === null) {
    const nextLen = 1 + 4 + 1
    if (db.modifyBuffer.len + nextLen > db.maxModifySize) {
      flushBuffer(db)
    }
    setCursor(db, schema, t.prop, id, false, fromCreate)
    db.modifyBuffer.buffer[db.modifyBuffer.len] = 11
    db.modifyBuffer.len++
  } else {
    if (5 + db.modifyBuffer.len + 11 > db.maxModifySize) {
      flushBuffer(db)
    }
    setCursor(db, schema, t.prop, id, false, fromCreate)
    db.modifyBuffer.buffer[db.modifyBuffer.len] = writeKey
    // if value == null...
    db.modifyBuffer.buffer.writeUint32LE(value, db.modifyBuffer.len + 1)
    db.modifyBuffer.len += 5
  }
}
