import { ModifyCtx } from '../../index.js'
import {
  SchemaTypeDef,
  isPropDef,
  REFERENCE,
  REFERENCES,
  STRING,
  TEXT,
  ALIAS,
  BINARY,
} from '../../server/schema/types.js'
import { ModifyError } from './ModifyRes.js'
import { writeReference } from './references/reference.js'
import { writeReferences } from './references/references.js'
import { writeString } from './string.js'
import { writeText } from './text.js'
import { MERGE_MAIN, ModifyErr, ModifyOp, RANGE_ERR } from './types.js'
import { writeBinary } from './binary.js'
import { setCursor } from './setCursor.js'
import { writeFixedValue } from './utils.js'
import { writeAlias } from './alias.js'

function _modify(
  ctx: ModifyCtx,
  parentId: number,
  obj: Record<string, any>,
  schema: SchemaTypeDef,
  mod: ModifyOp,
  tree: SchemaTypeDef['tree'],
  overwrite: boolean,
  unsafe: boolean,
): ModifyErr {
  for (const key in obj) {
    const def = tree[key]
    if (def === undefined) {
      if (unsafe) {
        continue
      }
      return new ModifyError(tree, key)
    }

    let err: ModifyErr
    if (isPropDef(def)) {
      const val = obj[key]
      const type = def.typeIndex
      if (def.separate) {
        if (type === STRING) {
          err = writeString(val, ctx, schema, def, parentId, mod)
        } else if (type === TEXT) {
          err = writeText(val, ctx, schema, def, parentId, mod)
        } else if (type === REFERENCE) {
          err = writeReference(val, ctx, schema, def, parentId, mod)
        } else if (type === REFERENCES) {
          err = writeReferences(val, ctx, schema, def, parentId, mod)
        } else if (type === BINARY) {
          err = writeBinary(val, ctx, schema, def, parentId, mod)
        } else if (type === ALIAS) {
          err = writeAlias(val, ctx, schema, def, parentId, mod)
        }
      } else if (overwrite) {
        if (ctx.len + 15 + schema.mainLen > ctx.max) {
          return RANGE_ERR
        }
        setCursor(ctx, schema, def.prop, parentId, mod, true)
        if (ctx.lastMain === -1) {
          let mainLenU32 = schema.mainLen
          setCursor(ctx, schema, def.prop, parentId, mod)
          ctx.buf[ctx.len++] = overwrite ? mod : MERGE_MAIN
          ctx.buf[ctx.len++] = mainLenU32
          ctx.buf[ctx.len++] = mainLenU32 >>>= 8
          ctx.buf[ctx.len++] = mainLenU32 >>>= 8
          ctx.buf[ctx.len++] = mainLenU32 >>>= 8
          ctx.lastMain = ctx.len
          ctx.buf.fill(0, ctx.len, (ctx.len += schema.mainLen))
        }
        err = writeFixedValue(ctx, val, def, ctx.lastMain + def.start)
      } else if (ctx.mergeMain) {
        ctx.mergeMain.push(def, val)
        ctx.mergeMainSize += def.len + 4
      } else {
        ctx.mergeMain = [def, val]
        ctx.mergeMainSize = def.len + 4
      }
    } else {
      err = _modify(
        ctx,
        parentId,
        obj[key],
        schema,
        mod,
        def,
        overwrite,
        unsafe,
      )
    }

    if (err) {
      return err
    }
  }
}

export function modify(
  ctx: ModifyCtx,
  parentId: number,
  obj: Record<string, any>,
  schema: SchemaTypeDef,
  mod: ModifyOp,
  tree: SchemaTypeDef['tree'],
  overwrite: boolean,
  unsafe: boolean = false,
): ModifyErr {
  ctx.db.markNodeDirty(schema, parentId)
  return _modify(ctx, parentId, obj, schema, mod, tree, overwrite, unsafe)
}
