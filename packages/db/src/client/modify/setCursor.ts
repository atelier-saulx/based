import { BasedDb } from '../../index.js'
import { SchemaTypeDef } from '../../server/schema/types.js'
import { CREATE, ModifyOp } from './types.js'
import { appendU32, appendU8 } from './utils.js'

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
    appendU8(ctx, 2)
    appendU8(ctx, prefix0)
    appendU8(ctx, prefix1)

    ctx.prefix0 = prefix0
    ctx.prefix1 = prefix1
    ctx.field = -1
    ctx.id = -1
    ctx.lastMain = -1
  }

  if (!ignoreField && ctx.field !== field) {
    appendU8(ctx, 0)
    appendU8(ctx, field)
    ctx.field = field
  }

  if (ctx.id !== id) {
    appendU8(ctx, modifyOp === CREATE ? 9 : 1)
    appendU32(ctx, id)

    ctx.id = id
    ctx.lastMain = -1
    // ctx.hasStringField = -1
  }
}
