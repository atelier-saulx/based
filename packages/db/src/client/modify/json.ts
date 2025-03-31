import { ModifyCtx } from '../../index.js'
import { PropDef, SchemaTypeDef } from '@based/schema/def'
import { ModifyOp, ModifyErr } from './types.js'
import { writeBinary } from './binary.js'
import { ModifyError } from './ModifyRes.js'

export function writeJson(
  value: any,
  ctx: ModifyCtx,
  schema: SchemaTypeDef,
  t: PropDef,
  parentId: number,
  modifyOp: ModifyOp,
): ModifyErr {
  // try catch cleaner error...
  try {
    return writeBinary(
      value === null ? null : JSON.stringify(value),
      ctx,
      schema,
      t,
      parentId,
      modifyOp,
    )
  } catch (err) {
    return new ModifyError(t, value)
  }
}
