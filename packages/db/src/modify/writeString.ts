import { BasedDb } from '../index.js'
import { flushBuffer } from '../operations.js'
import { SchemaTypeDef, PropDef } from '../schema/types.js'
import { _ModifyRes } from './ModifyRes.js'
import { setCursor } from './setCursor.js'

export function writeString(
  value: any,
  fromCreate: boolean,
  db: BasedDb,
  schema: SchemaTypeDef,
  t: PropDef,
  res: _ModifyRes,
  writeKey: 3 | 6,
) {
  const len = value === null ? 0 : value.length
  if (len === 0) {
    if (!fromCreate) {
      const nextLen = 1 + 4 + 1
      if (db.modifyBuffer.len + nextLen > db.maxModifySize) {
        flushBuffer(db)
      }
      setCursor(db, schema, t.prop, res.tmpId, false, fromCreate)
      db.modifyBuffer.buffer[db.modifyBuffer.len] = 11
      db.modifyBuffer.len++
    }
  } else {
    if (fromCreate) {
      schema.stringPropsCurrent[t.prop] = 2
      db.modifyBuffer.hasStringField++
    }
    const byteLen = len + len
    if (byteLen + 5 + db.modifyBuffer.len + 11 > db.maxModifySize) {
      flushBuffer(db)
    }
    setCursor(db, schema, t.prop, res.tmpId, false, fromCreate)
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
