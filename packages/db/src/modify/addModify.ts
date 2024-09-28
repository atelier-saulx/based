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
import { writeFixedLenValue } from './fixedLen.js'
import { writeReference } from './references/reference.js'
import { writeReferences } from './references/references.js'
import { writeString } from './string.js'
import { CREATE, MERGE_MAIN, ModifyOp } from './types.js'
import { maybeFlush, initField, initId, initType } from './utils.js'

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
      initField(db, propDef.prop)
      if (!initiated) {
        initId(db, res.tmpId, modifyOp)
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
        const ctx = db.modifyCtx
        if (ctx.lastMain === -1) {
          const buf = ctx.buffer
          const mainLen = schema.mainLen
          const requiredLen = ctx.len + mainLen + 1 + 4 + 5

          maybeFlush(db, requiredLen)

          let pos = ctx.len
          let val = mainLen

          buf[pos++] = overwrite ? modifyOp : MERGE_MAIN
          buf[pos++] = val
          buf[pos++] = val >>>= 8
          buf[pos++] = val >>>= 8
          buf[pos++] = val >>>= 8
          ctx.lastMain = pos
          ctx.len = pos + mainLen
          buf.fill(0, ctx.len - mainLen, ctx.len)
        }

        writeFixedLenValue(
          db,
          obj[key],
          propDef.start + ctx.lastMain,
          propDef,
          res,
        )
      } else {
        const ctx = db.modifyCtx
        if (ctx.mergeMain) {
          ctx.mergeMain.push(propDef, obj[key])
          ctx.mergeMainSize += propDef.len + 4
        } else {
          ctx.mergeMain = [propDef, obj[key]]
          ctx.mergeMainSize = propDef.len + 4
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
  db: BasedDb,
  res: ModifyState,
  obj: Record<string, any>,
  def: SchemaTypeDef,
  modifyOp: ModifyOp,
  tree: SchemaTypeDef['tree'],
  overwrite: boolean,
): void => {
  const ctx = db.modifyCtx
  const { lastMain, prefix0, prefix1, field, len } = ctx

  ctx.modifyOp = modifyOp

  initType(db, def)

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
    ctx.lastMain = lastMain
    ctx.prefix0 = prefix0
    ctx.prefix1 = prefix1
    ctx.field = field
    ctx.len = len
    ctx.id = -1
  } else if (modifyOp === CREATE) {
    if (!initiated || def.mainLen === 0) {
      initField(db, 0)
      initId(db, res.tmpId, modifyOp)
    }
  }
}
