import { ModifyCtx } from '../../index.js'
import { PropDef, SchemaTypeDef } from '@based/schema/def'
import { ModifyOp, ModifyErr, CREATE } from './types.js'
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
  try {
    if (value === null) {
      return writeBinary(null, ctx, schema, t, parentId, modifyOp)
    } else {
      if (!t.validation(value, t)) {
        return new ModifyError(t, value)
      }
      if (modifyOp === CREATE) {
        if (schema.hasSeperateDefaults) {
          schema.separateDefaults.bufferTmp[t.prop] = 1
          ctx.hasDefaults++
        }
      }
      return writeBinary(
        JSON.stringify(value),
        ctx,
        schema,
        t,
        parentId,
        modifyOp,
      )
    }
  } catch (err) {
    return new ModifyError(t, value)
  }
}
