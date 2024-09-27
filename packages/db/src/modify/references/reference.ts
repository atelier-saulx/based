import { BasedDb } from '../../index.js'
import { flushBuffer } from '../../operations.js'
import { SchemaTypeDef, PropDef } from '../../schema/types.js'
import { ModifyState, modifyError } from '../ModifyRes.js'
import { setCursor } from '../setCursor.js'
import { RefModifyOpts } from './references.js'

function singleReferencEdges(
  value: RefModifyOpts,
  db: BasedDb,
  schema: SchemaTypeDef,
  t: PropDef,
  res: ModifyState,
  fromCreate: boolean,
  writeKey: 3 | 6,
) {
  console.log('GO GO GO')
}

export function writeReference(
  value: number | ModifyState,
  db: BasedDb,
  schema: SchemaTypeDef,
  t: PropDef,
  res: ModifyState,
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
    return
  }

  if (typeof value !== 'number') {
    if (value instanceof ModifyState) {
      if (value.error) {
        res.error = value.error
        return
      }
      value = value.tmpId
    } else if (t.edges && typeof value === 'object') {
      singleReferencEdges(value, db, schema, t, res, fromCreate, writeKey)
      return
    } else {
      modifyError(res, t, value)
      return
    }
  }

  if (5 + db.modifyBuffer.len + 11 > db.maxModifySize) {
    flushBuffer(db)
  }

  setCursor(db, schema, t.prop, res.tmpId, false, fromCreate)
  db.modifyBuffer.buffer[db.modifyBuffer.len] = writeKey
  db.modifyBuffer.buffer.writeUint32LE(value, db.modifyBuffer.len + 1)
  db.modifyBuffer.len += 5
}
