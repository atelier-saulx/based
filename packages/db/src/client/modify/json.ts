import { ModifyCtx } from '../../index.js'
import { PropDef, SchemaTypeDef } from '../../server/schema/types.js'
import { ModifyOp, ModifyErr } from './types.js'
import { writeBinary } from './binary.js'

export function writeJson(
  value: any,
  ctx: ModifyCtx,
  schema: SchemaTypeDef,
  t: PropDef,
  parentId: number,
  modifyOp: ModifyOp,
): ModifyErr {
  return writeBinary(JSON.stringify(value), ctx, schema, t, parentId, modifyOp)
}
