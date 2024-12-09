import { BasedDb } from '../../index.js'
import { CREATE, ModifyOp } from './types.js'
import { appendU32, appendU8 } from './utils.js'

export const setCursor = (
  ctx: BasedDb['modifyCtx'],
  field: number,
  id: number,
  modifyOp: ModifyOp,
  ignoreField?: boolean,
) => {
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
  }
}
