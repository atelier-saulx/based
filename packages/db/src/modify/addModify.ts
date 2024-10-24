import { BasedDb } from '../index.js'
import { flushBuffer } from '../operations.js'
import {
  SchemaTypeDef,
  isPropDef,
  REFERENCE,
  REFERENCES,
  STRING,
  ALIAS,
  BINARY,
  // ALIAS,
} from '../schema/types.js'
import { modifyError, ModifyState } from './ModifyRes.js'
import { setCursor } from './setCursor.js'
import { writeFixedLenValue } from './fixedLen.js'
import { writeReference } from './references/reference.js'
import { writeReferences } from './references/references.js'
import { writeString } from './string.js'
import { MERGE_MAIN, ModifyOp } from './types.js'
import { writeBinary } from './binary.js'

const _addModify = (
  ctx: BasedDb['modifyCtx'],
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
      if (type === ALIAS) {
        writeString(obj[key], ctx, schema, propDef, res, modifyOp)
      } else if (type === REFERENCE) {
        writeReference(obj[key], ctx, schema, propDef, res, modifyOp)
      } else if (type === REFERENCES) {
        writeReferences(obj[key], ctx, schema, propDef, res, modifyOp)
      } else if (type === BINARY) {
        writeBinary(obj[key], ctx, schema, propDef, res, modifyOp)
      } else if (type === STRING && propDef.separate === true) {
        writeString(obj[key], ctx, schema, propDef, res, modifyOp)
      } else if (overwrite) {
        setCursor(ctx, schema, propDef.prop, res.tmpId, modifyOp, true)
        if (ctx.lastMain === -1) {
          const buf = ctx.buf
          const mainLen = schema.mainLen
          const nextLen = mainLen + 1 + 4

          if (ctx.len + nextLen + 5 > ctx.max) {
            flushBuffer(ctx.db)
          }
          setCursor(ctx, schema, propDef.prop, res.tmpId, modifyOp)

          const pos = ctx.len
          buf[pos] = overwrite ? modifyOp : MERGE_MAIN
          buf[pos + 1] = mainLen
          buf[pos + 2] = mainLen >>> 8
          buf[pos + 3] = mainLen >>> 16
          buf[pos + 4] = mainLen >>> 24
          ctx.lastMain = pos + 1 + 4
          ctx.len += nextLen
          buf.fill(0, ctx.len - mainLen, ctx.len)
        }
        writeFixedLenValue(
          ctx,
          obj[key],
          propDef.start + ctx.lastMain,
          propDef,
          res,
        )
      } else {
        if (ctx.mergeMain) {
          ctx.mergeMain.push(propDef, obj[key])
          ctx.mergeMainSize += propDef.len + 4
        } else {
          ctx.mergeMain = [propDef, obj[key]]
          ctx.mergeMainSize = propDef.len + 4
        }
      }
    } else {
      _addModify(ctx, res, obj[key], schema, modifyOp, propDef, overwrite)
    }

    if (res.error !== undefined) {
      return
    }
  }
}

export const addModify: typeof _addModify = (
  ctx,
  res,
  obj,
  def,
  modifyOp,
  tree,
  overwrite,
) => {
  // TODO we dont need this stuff here
  const { lastMain, prefix0, prefix1, field, len, id } = ctx

  _addModify(ctx, res, obj, def, modifyOp, tree, overwrite)

  if (res.error) {
    // TODO this is not correct if its flushed
    ctx.lastMain = lastMain
    ctx.prefix0 = prefix0
    ctx.prefix1 = prefix1
    ctx.field = field
    ctx.len = len
    ctx.id = id
  }
}
