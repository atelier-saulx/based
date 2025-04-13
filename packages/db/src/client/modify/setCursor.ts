import { ModifyCtx } from '../../index.js'
import { SchemaTypeDef } from '@based/schema/def'
import {
  CREATE,
  ModifyOp,
  SWITCH_FIELD,
  SWITCH_ID_CREATE,
  SWITCH_ID_UPDATE,
  SWITCH_TYPE,
} from './types.js'

export const setCursor = (
  ctx: ModifyCtx,
  schema: SchemaTypeDef,
  field: number, // TODO pass propdef better
  typeIndex: number,
  id: number,
  modifyOp: ModifyOp,
  ignoreField?: boolean,
) => {
  const prefix0 = schema.idUint8[0]
  const prefix1 = schema.idUint8[1]

  if (ctx.prefix0 !== prefix0 || ctx.prefix1 !== prefix1) {
    ctx.buf[ctx.len++] = SWITCH_TYPE // switch node type
    ctx.buf[ctx.len++] = prefix0 // type1
    ctx.buf[ctx.len++] = prefix1 // type2
    ctx.prefix0 = prefix0
    ctx.prefix1 = prefix1
    ctx.field = -1
    ctx.id = -1
    ctx.lastMain = -1
    if (modifyOp === CREATE) {
      ctx.markTypeDirty(schema)
    }
  }

  if (!ignoreField && ctx.field !== field) {
    ctx.buf[ctx.len++] = SWITCH_FIELD // switch field
    ctx.buf[ctx.len++] = field // actual field
    ctx.buf[ctx.len++] = typeIndex
    ctx.field = field
  }

  if (ctx.id !== id) {
    ctx.markNodeDirty(schema, id)
    ctx.id = id
    ctx.lastMain = -1
    ctx.buf[ctx.len++] =
      modifyOp === CREATE ? SWITCH_ID_CREATE : SWITCH_ID_UPDATE // swtch id
    ctx.buf[ctx.len++] = id
    ctx.buf[ctx.len++] = id >>>= 8
    ctx.buf[ctx.len++] = id >>>= 8
    ctx.buf[ctx.len++] = id >>>= 8
  }
}
