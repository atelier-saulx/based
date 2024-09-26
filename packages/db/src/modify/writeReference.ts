import { BasedDb } from '../index.js'
import { flushBuffer } from '../operations.js'
import { SchemaTypeDef, PropDef } from '../schema/types.js'
import { _ModifyRes } from './ModifyRes.js'
import { setCursor } from './setCursor.js'

export function writeReference(
  value: any,
  db: BasedDb,
  schema: SchemaTypeDef,
  t: PropDef,
  res: _ModifyRes,
  fromCreate: boolean,
  writeKey: 3 | 6,
) {
  if (value === null) {
    const nextLen = 1 + 4 + 1
    if (db.modifyBuffer.len + nextLen > db.maxModifySize) {
      flushBuffer(db)
    }
    setCursor(db, schema, t.prop, res.tmpId, false, fromCreate)
    db.modifyBuffer.buffer[db.modifyBuffer.len] = 11
    db.modifyBuffer.len++
  } else {
    if (5 + db.modifyBuffer.len + 11 > db.maxModifySize) {
      flushBuffer(db)
    }
    setCursor(db, schema, t.prop, res.tmpId, false, fromCreate)
    db.modifyBuffer.buffer[db.modifyBuffer.len] = writeKey
    // if value == null...
    db.modifyBuffer.buffer.writeUint32LE(value, db.modifyBuffer.len + 1)
    db.modifyBuffer.len += 5
  }
}
