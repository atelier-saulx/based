import { BasedDb } from '../index.js'
import { flushBuffer } from '../operations.js'
import { SchemaTypeDef, PropDef } from '../schema/types.js'
import { modifyError, ModifyState } from './ModifyRes.js'
import { setCursor } from './setCursor.js'
import { writeFixedLenValue } from './fixedLen.js'
import { writeReference } from './references/reference.js'
import { writeReferences } from './references/references.js'
import { writeString } from './string.js'
import { ModifyOp } from './types.js'

const EMPTY_BUFFER = Buffer.alloc(1000)

const _addModify = (
  db: BasedDb,
  res: ModifyState,
  obj: { [key: string]: any },
  tree: SchemaTypeDef['tree'],
  schema: SchemaTypeDef,
  modifyOp: ModifyOp,
  merge: boolean,
): boolean => {
  let wroteMain = false
  for (const key in obj) {
    if (res.error) {
      return
    }

    const leaf = tree[key]

    if (!leaf) {
      modifyError(res, tree, key)
      return
    }

    const value = obj[key]
    if (!leaf.__isPropDef) {
      if (
        _addModify(
          db,
          res,
          value,
          leaf as SchemaTypeDef['tree'],
          schema,
          modifyOp,
          merge,
        )
      ) {
        wroteMain = true
      }
    } else {
      const t = leaf as PropDef

      // 13: reference
      if (t.typeIndex === 13) {
        writeReference(value, db, schema, t, res, modifyOp)
        continue
      }

      // 14: references
      if (t.typeIndex === 14) {
        writeReferences(t, db, modifyOp, value, schema, res)
        continue
      }

      // 11: string
      if (t.typeIndex === 11 && t.separate === true) {
        writeString(value, db, schema, t, res, modifyOp)
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
      setCursor(db, schema, t.prop, res.tmpId, modifyOp, true)
      let mainIndex = db.modifyBuffer.lastMain
      if (mainIndex === -1) {
        const nextLen = schema.mainLen + 1 + 4
        if (db.modifyBuffer.len + nextLen + 5 > db.maxModifySize) {
          flushBuffer(db)
        }
        setCursor(db, schema, t.prop, res.tmpId, modifyOp)
        db.modifyBuffer.buffer[db.modifyBuffer.len] = merge ? 4 : modifyOp
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

      writeFixedLenValue(db, value, t.start + mainIndex, t, res)
    }
  }

  return wroteMain
}

export const addModify = (
  db: BasedDb,
  res: ModifyState,
  obj: { [key: string]: any },
  tree: SchemaTypeDef['tree'],
  def: SchemaTypeDef,
  modifyOp: ModifyOp,
  merge: boolean,
) => {
  const prefix0 = db.modifyBuffer.prefix0
  const prefix1 = db.modifyBuffer.prefix1
  const lastMain = db.modifyBuffer.lastMain
  const field = db.modifyBuffer.field
  const len = db.modifyBuffer.len
  const id = db.modifyBuffer.id
  const wroteMain = _addModify(db, res, obj, tree, def, modifyOp, merge)

  if (res.error) {
    db.modifyBuffer.prefix0 = prefix0
    db.modifyBuffer.prefix1 = prefix1
    db.modifyBuffer.lastMain = lastMain
    db.modifyBuffer.field = field
    db.modifyBuffer.len = len
    db.modifyBuffer.id = id
  }

  return wroteMain
}
