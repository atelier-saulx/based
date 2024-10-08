import { BasedDb } from '../index.js'
import { SchemaTypeDef } from '../schema/types.js'
import { CREATE, ModifyOp } from './types.js'

export const setCursor = (
  ctx: BasedDb['modifyCtx'],
  schema: SchemaTypeDef,
  field: number,
  id: number,
  modifyOp: ModifyOp,
  ignoreField?: boolean,
) => {
  // 0 switch field
  // 1 switch id
  // 2 switch type
  const prefix0 = schema.idUint8[0]
  const prefix1 = schema.idUint8[1]

  if (ctx.prefix0 !== prefix0 || ctx.prefix1 !== prefix1) {
    // switch type
    ctx.buf[ctx.len] = 2
    ctx.buf[ctx.len + 1] = prefix0
    ctx.buf[ctx.len + 2] = prefix1
    ctx.len += 3
    ctx.prefix0 = prefix0
    ctx.prefix1 = prefix1
    ctx.field = -1
    ctx.id = -1
    ctx.lastMain = -1
  }

  if (!ignoreField && ctx.field !== field) {
    // switch field
    ctx.buf[ctx.len] = 0
    // make field 2 bytes
    ctx.buf[ctx.len + 1] = field // 1 byte (max size 255 - 1)
    ctx.len += 2
    ctx.field = field
  }

  if (ctx.id !== id) {
    // switch node
    ctx.hasStringField = -1
    ctx.buf[ctx.len] = modifyOp === CREATE ? 9 : 1
    ctx.buf.writeUInt32LE(id, ctx.len + 1)
    ctx.len += 5
    ctx.id = id
    ctx.lastMain = -1
  }
}
