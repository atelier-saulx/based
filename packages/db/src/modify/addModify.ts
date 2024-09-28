import { BasedDb } from '../index.js'
import { flushBuffer } from '../operations.js'
import {
  SchemaTypeDef,
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
import { CREATE, MERGE_MAIN, ModifyOp } from './types.js'
import { maybeFlush, setField, setId, setType } from './utils.js'

const _addModify = (
  db: BasedDb,
  res: ModifyState,
  obj: Record<string, any>,
  schema: SchemaTypeDef,
  modifyOp: ModifyOp,
  tree: SchemaTypeDef['tree'],
  overwrite: boolean,
  initiated: boolean,
): boolean => {
  for (const key in obj) {
    const propDef = tree[key]
    if (propDef === undefined) {
      modifyError(res, tree, key)
    } else if (isPropDef(propDef)) {
      setField(db, propDef.prop)
      if (!initiated) {
        setId(db, res.tmpId, modifyOp)
        initiated = true
      }
      const type = propDef.typeIndex
      if (type === REFERENCE) {
        writeReference(obj[key], db, propDef, res, modifyOp)
      } else if (type === REFERENCES) {
        writeReferences(obj[key], db, propDef, res, modifyOp)
      } else if (type === STRING && propDef.separate === true) {
        writeString(obj[key], db, schema, propDef, res, modifyOp)
      } else if (overwrite) {
        const mod = db.modifyCtx
        if (mod.lastMain === -1) {
          const buf = mod.buffer
          const mainLen = schema.mainLen
          const requiredLen = mod.len + mainLen + 1 + 4 + 5

          maybeFlush(db, requiredLen)

          let pos = mod.len
          let val = mainLen

          buf[pos++] = overwrite ? modifyOp : MERGE_MAIN
          buf[pos++] = val
          buf[pos++] = val >>>= 8
          buf[pos++] = val >>>= 8
          buf[pos++] = val >>>= 8
          mod.lastMain = pos
          mod.len = pos + mainLen
          buf.fill(0, mod.len - mainLen, mod.len)
        }

        writeFixedLenValue(
          db,
          obj[key],
          propDef.start + mod.lastMain,
          propDef,
          res,
        )
      } else {
        const mod = db.modifyCtx
        if (mod.mergeMain) {
          mod.mergeMain.push(propDef, obj[key])
          mod.mergeMainSize += propDef.len + 4
        } else {
          mod.mergeMain = [propDef, obj[key]]
          mod.mergeMainSize = propDef.len + 4
        }
      }
    } else {
      _addModify(
        db,
        res,
        obj[key],
        schema,
        modifyOp,
        propDef,
        overwrite,
        initiated,
      )
    }

    if (res.error !== undefined) {
      return
    }
  }

  return initiated
}

export const addModify = (
  db,
  res,
  obj,
  def,
  modifyOp,
  tree,
  overwrite,
): void => {
  const mod = db.modifyCtx
  const { lastMain, prefix0, prefix1, field, len } = mod

  mod.modifyOp = modifyOp

  setType(db, def)

  const initiated = _addModify(
    db,
    res,
    obj,
    def,
    modifyOp,
    tree,
    overwrite,
    false,
  )

  if (res.error) {
    // this is wrong in case of a flush....
    mod.lastMain = lastMain
    mod.prefix0 = prefix0
    mod.prefix1 = prefix1
    mod.field = field
    mod.len = len
    mod.id = -1
  } else if (modifyOp === CREATE) {
    if (!initiated || def.mainLen === 0) {
      setField(db, 0)
      setId(db, res.tmpId, modifyOp)
      // setCursor(db, def, 0, res.tmpId, CREATE)
    }
  }
}
