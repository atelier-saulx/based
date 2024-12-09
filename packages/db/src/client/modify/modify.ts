import { ModifyCtx } from '../../index.js'
import {
  SchemaTypeDef,
  isPropDef,
  REFERENCE,
  REFERENCES,
  STRING,
  ALIAS,
  BINARY,
} from '../../server/schema/types.js'
import { ModifyError, ModifyState } from './ModifyRes.js'
import { writeReference } from './references/reference.js'
import { writeReferences } from './references/references.js'
import { writeString } from './string.js'
import { ModifyErr, ModifyOp } from './types.js'
import { writeBinary } from './binary.js'
import { writeMain } from './main.js'
import { appendU8 } from './utils.js'

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
      const type = def.typeIndex
      const val = obj[key]
      if (type === ALIAS) {
        err = writeString(val, ctx, schema, def, parentId, mod)
      } else if (type === REFERENCE) {
        err = writeReference(val, ctx, def, parentId, mod)
      } else if (type === REFERENCES) {
        err = writeReferences(val, ctx, schema, def, parentId, mod)
      } else if (type === BINARY && def.separate === true) {
        err = writeBinary(val, ctx, def, parentId, mod)
      } else if (type === STRING && def.separate === true) {
        err = writeString(val, ctx, schema, def, parentId, mod)
      } else {
        err = writeMain(val, ctx, schema.mainLen, def, parentId, mod, overwrite)
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

// const fastModify = (
//   ctx: ModifyCtx,
//   parentId: number,
//   obj: Record<string, any>,
//   schema: SchemaTypeDef,
//   mod: ModifyOp,
//   tree: SchemaTypeDef['tree'],
//   overwrite: boolean,
//   unsafe: boolean,
// ) => {
//   let err
//   if () {

//   }
// }

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

  // 0 switch field
  // 1 switch id
  // 2 switch type
  const prefix0 = schema.idUint8[0]
  const prefix1 = schema.idUint8[1]

  if (ctx.prefix0 !== prefix0 || ctx.prefix1 !== prefix1) {
    appendU8(ctx, 2)
    appendU8(ctx, prefix0)
    appendU8(ctx, prefix1)

    ctx.prefix0 = prefix0
    ctx.prefix1 = prefix1
    ctx.field = -1
    ctx.id = -1
    ctx.lastMain = -1
  }

  return _modify(ctx, parentId, obj, schema, mod, tree, overwrite, unsafe)
}
