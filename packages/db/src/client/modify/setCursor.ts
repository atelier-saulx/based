import { ModifyCtx } from '../../index.js'
import { SchemaTypeDef } from '../../server/schema/types.js'
import { CREATE, ModifyOp } from './types.js'

export const setCursor = (
  ctx: ModifyCtx,
  field: number,
  id: number,
  modifyOp: ModifyOp,
  ignoreField?: boolean,
) => {
  if (!ignoreField && ctx.field !== field) {
    ctx.buf[ctx.len++] = 0
    ctx.buf[ctx.len++] = field
    ctx.field = field
  }

  if (ctx.id !== id) {
    ctx.id = id
    ctx.lastMain = -1
    ctx.buf[ctx.len++] = modifyOp === CREATE ? 9 : 1
    ctx.buf[ctx.len++] = id
    ctx.buf[ctx.len++] = id >>>= 8
    ctx.buf[ctx.len++] = id >>>= 8
    ctx.buf[ctx.len++] = id >>>= 8
  }
}

export const initCursor = (ctx: ModifyCtx, schema: SchemaTypeDef) => {
  const prefix0 = schema.idUint8[0]
  const prefix1 = schema.idUint8[1]
  if (ctx.prefix0 !== prefix0 || ctx.prefix1 !== prefix1) {
    ctx.buf[ctx.len++] = 2
    ctx.buf[ctx.len++] = prefix0
    ctx.buf[ctx.len++] = prefix1
    ctx.prefix0 = prefix0
    ctx.prefix1 = prefix1
    ctx.field = -1
    ctx.id = -1
    ctx.lastMain = -1
  }
}
