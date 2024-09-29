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
import { MERGE_MAIN, ModifyOp } from './types.js'

const _addModify = (
  db: BasedDb,
  res: ModifyState,
  obj: Record<string, any>,
  schema: SchemaTypeDef,
  modifyOp: ModifyOp,
  tree: SchemaTypeDef['tree'],
  overwrite: boolean,
) => {
  for (const key in obj) {
    const propDef = tree[key]
    if (propDef === undefined) {
      modifyError(res, tree, key)
    } else if (isPropDef(propDef)) {
      const type = propDef.typeIndex
      if (type === REFERENCE) {
        writeReference(obj[key], db, schema, propDef, res, modifyOp)
      } else if (type === REFERENCES) {
        writeReferences(obj[key], db, schema, propDef, res, modifyOp)
      } else if (type === STRING && propDef.separate === true) {
        writeString(obj[key], db, schema, propDef, res, modifyOp)
      } else if (overwrite) {
        setCursor(db, schema, propDef.prop, res.tmpId, modifyOp, true)
        const mod = db.modifyCtx
        if (mod.lastMain === -1) {
          const buf = mod.buffer
          const mainLen = schema.mainLen
          const nextLen = mainLen + 1 + 4
          if (mod.len + nextLen + 5 > db.maxModifySize) {
            flushBuffer(db)
          }
          setCursor(db, schema, propDef.prop, res.tmpId, modifyOp)
          const pos = mod.len
          buf[pos] = overwrite ? modifyOp : MERGE_MAIN
          buf[pos + 1] = mainLen
          buf[pos + 2] = mainLen >>> 8
          buf[pos + 3] = mainLen >>> 16
          buf[pos + 4] = mainLen >>> 24
          mod.lastMain = pos + 1 + 4
          mod.len += nextLen
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
      _addModify(db, res, obj[key], schema, modifyOp, propDef, overwrite)
    }

    if (res.error !== undefined) {
      return
    }
  }
}

export const addModify: typeof _addModify = (
  db,
  res,
  obj,
  def,
  modifyOp,
  tree,
  overwrite,
) => {
  // TODO we dont need this stuff here
  const { lastMain, prefix0, prefix1, field, len, id } = db.modifyCtx

  _addModify(db, res, obj, def, modifyOp, tree, overwrite)

  if (res.error) {
    const mod = db.modifyCtx
    mod.lastMain = lastMain
    mod.prefix0 = prefix0
    mod.prefix1 = prefix1
    mod.field = field
    mod.len = len
    mod.id = id
  }
}
