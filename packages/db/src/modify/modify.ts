import { BasedDb } from '../index.js'
import {
  SchemaTypeDef,
  isPropDef,
  REFERENCE,
  REFERENCES,
  STRING,
  ALIAS,
  BINARY,
} from '../schema/types.js'
import { ModifyError, ModifyState } from './ModifyRes.js'
import { writeReference } from './references/reference.js'
import { writeReferences } from './references/references.js'
import { writeString } from './string.js'
import { ModifyErr, ModifyOp } from './types.js'
import { writeBinary } from './binary.js'
import { writeMain } from './main.js'

export function modify(
  ctx: BasedDb['modifyCtx'],
  res: ModifyState,
  obj: Record<string, any>,
  schema: SchemaTypeDef,
  mod: ModifyOp,
  tree: SchemaTypeDef['tree'],
  overwrite: boolean,
): ModifyErr {
  ctx.db.markNodeDirty(schema.id, res.tmpId)
  for (const key in obj) {
    const def = tree[key]
    if (def === undefined) {
      return new ModifyError(tree, key)
    }

    let err: ModifyErr
    if (isPropDef(def)) {
      const type = def.typeIndex
      const val = obj[key]
      if (type === ALIAS) {
        err = writeString(val, ctx, schema, def, res, mod)
      } else if (type === REFERENCE) {
        err = writeReference(val, ctx, schema, def, res, mod)
      } else if (type === REFERENCES) {
        err = writeReferences(val, ctx, schema, def, res, mod)
      } else if (type === BINARY) {
        err = writeBinary(val, ctx, schema, def, res, mod)
      } else if (type === STRING && def.separate === true) {
        err = writeString(val, ctx, schema, def, res, mod)
      } else {
        err = writeMain(val, ctx, schema, def, res, mod, overwrite)
      }
    } else {
      err = modify(ctx, res, obj[key], schema, mod, def, overwrite)
    }

    if (err) {
      return err
    }
  }
}
