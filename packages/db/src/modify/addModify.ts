import { BasedDb } from '../index.js'
import { flushBuffer } from '../operations.js'
import { SchemaTypeDef, PropDef } from '../schema/types.js'
import { _ModifyRes } from './ModifyRes.js'
import { setCursor } from './setCursor.js'
import { writeFixedLenValue } from './writeFixedLen.js'
import { writeReference } from './writeReference.js'
import { writeReferences } from './writeReferences.js'
import { writeString } from './writeString.js'

const EMPTY_BUFFER = Buffer.alloc(1000)

export const addModify = (
  db: BasedDb,
  res: _ModifyRes,
  obj: { [key: string]: any },
  tree: SchemaTypeDef['tree'],
  schema: SchemaTypeDef,
  writeKey: 3 | 6,
  merge: boolean,
  fromCreate: boolean,
): boolean => {
  let wroteMain = false
  for (const key in obj) {
    if (res.error) {
      wroteMain = false
      return
    }
    const leaf = tree[key]
    const value = obj[key]
    if (!leaf.__isPropDef) {
      if (
        addModify(
          db,
          res,
          value,
          leaf as SchemaTypeDef['tree'],
          schema,
          writeKey,
          merge,
          fromCreate,
        )
      ) {
        wroteMain = true
      }
    } else {
      const t = leaf as PropDef
      // 13: reference
      if (t.typeIndex === 13) {
        writeReference(value, db, schema, t, res, fromCreate, writeKey)
        continue
      }

      // 14: references
      if (t.typeIndex === 14) {
        writeReferences(t, db, writeKey, value, schema, res, fromCreate)
        continue
      }

      // 11: string
      if (t.typeIndex === 11 && t.seperate === true) {
        writeString(value, fromCreate, db, schema, t, res, writeKey)
        continue
      }

      if (merge) {
        wroteMain = true
        if (!db.modifyBuffer.mergeMain) {
          db.modifyBuffer.mergeMain = []
        }
        db.modifyBuffer.mergeMain.push(t, value)
        db.modifyBuffer.mergeMainSize += t.len + 4
        continue
      }

      // Fixed length main buffer
      wroteMain = true
      setCursor(db, schema, t.prop, res.tmpId, true, fromCreate)
      let mainIndex = db.modifyBuffer.lastMain
      if (mainIndex === -1) {
        const nextLen = schema.mainLen + 1 + 4
        if (db.modifyBuffer.len + nextLen + 5 > db.maxModifySize) {
          flushBuffer(db)
        }
        setCursor(db, schema, t.prop, res.tmpId, false, fromCreate)
        db.modifyBuffer.buffer[db.modifyBuffer.len] = merge ? 4 : writeKey
        db.modifyBuffer.buffer.writeUint32LE(
          schema.mainLen,
          db.modifyBuffer.len + 1,
        )
        mainIndex = db.modifyBuffer.lastMain = db.modifyBuffer.len + 1 + 4
        db.modifyBuffer.len += nextLen
        const size = db.modifyBuffer.len - schema.mainLen
        if (schema.mainLen < 1e3) {
          EMPTY_BUFFER.copy(db.modifyBuffer.buffer, size, 0, schema.mainLen)
        } else {
          for (let x = 0; x < schema.mainLen; x++) {
            db.modifyBuffer.buffer[size + x] = 0
          }
        }
      }

      writeFixedLenValue(db, value, t.start + mainIndex, t)
    }
  }

  return wroteMain
}
