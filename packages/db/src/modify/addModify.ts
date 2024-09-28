import { BasedDb } from '../index.js'
import { flushBuffer } from '../operations.js'
import {
  SchemaTypeDef,
  PropDef,
  isPropDef,
  REFERENCE,
  REFERENCES,
  STRING,
} from '../schema/types.js'
import { modifyError, ModifyState } from './ModifyRes.js'
import { setCursor } from './setCursor.js'
import { writeFixedLenValue } from './fixedLen.js'
import { writeReference } from './references/reference.js'
import { writeReferences } from './references/references.js'
import { writeString } from './string.js'
import { MERGE_MAIN, ModifyOp } from './types.js'

const EMPTY_BUFFER = Buffer.alloc(1000)

const _addModify = (
  db: BasedDb,
  res: ModifyState,
  obj: Record<string, any>,
  schema: SchemaTypeDef,
  modifyOp: ModifyOp,
  merge: boolean,
  tree: SchemaTypeDef['tree'],
): boolean => {
  let wroteMain = false
  for (const key in obj) {
    if (res.error !== undefined) {
      return
    }

    const propDef = tree[key]
    if (propDef === undefined) {
      modifyError(res, tree, key)
      return
    }

    const value = obj[key]
    if (isPropDef(propDef)) {
      if (propDef.typeIndex === REFERENCE) {
        writeReference(value, db, schema, propDef, res, modifyOp)
        continue
      }
      if (propDef.typeIndex === REFERENCES) {
        writeReferences(propDef, db, modifyOp, value, schema, res)
        continue
      }
      if (propDef.typeIndex === STRING && propDef.separate === true) {
        writeString(value, db, schema, propDef, res, modifyOp)
        continue
      }
      if (merge) {
        wroteMain = true
        const mod = db.modifyBuffer
        if (mod.mergeMain) {
          mod.mergeMain.push(propDef, value)
          mod.mergeMainSize += propDef.len + 4
        } else {
          mod.mergeMain = [propDef, value]
          mod.mergeMainSize = propDef.len + 4
        }
        continue
      }

      // Fixed length main buffer
      wroteMain = true
      setCursor(db, schema, propDef.prop, res.tmpId, modifyOp, true)
      const mod = db.modifyBuffer
      if (mod.lastMain === -1) {
        const buf = mod.buffer
        const mainLen = schema.mainLen
        const nextLen = mainLen + 1 + 4
        if (mod.len + nextLen + 5 > db.maxModifySize) {
          flushBuffer(db)
        }
        setCursor(db, schema, propDef.prop, res.tmpId, modifyOp)
        buf[mod.len] = merge ? MERGE_MAIN : modifyOp
        buf.writeUint32LE(mainLen, mod.len + 1)
        mod.lastMain = mod.len + 1 + 4
        mod.len += nextLen
        const size = mod.len - mainLen
        if (mainLen < 1e3) {
          EMPTY_BUFFER.copy(buf, size, 0, mainLen)
        } else {
          let i = mainLen + size
          while (i--) {
            buf[i] = 0
          }
        }
      }

      writeFixedLenValue(db, value, propDef.start + mod.lastMain, propDef, res)
    } else {
      if (_addModify(db, res, value, schema, modifyOp, merge, propDef)) {
        wroteMain = true
      }
    }
  }

  return wroteMain
}

export const addModify: typeof _addModify = (
  db,
  res,
  obj,
  def,
  modifyOp,
  merge,
  tree,
) => {
  const { lastMain, prefix0, prefix1, field, len, id } = db.modifyBuffer
  const wroteMain = _addModify(db, res, obj, def, modifyOp, merge, tree)

  if (res.error) {
    const mod = db.modifyBuffer
    mod.lastMain = lastMain
    mod.prefix0 = prefix0
    mod.prefix1 = prefix1
    mod.field = field
    mod.len = len
    mod.id = id
  }

  return wroteMain
}
