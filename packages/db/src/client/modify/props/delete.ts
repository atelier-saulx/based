import { Ctx } from '../Ctx.js'
import { PropDef } from '@based/schema/def'
import { DELETE, UPDATE } from '../types.js'
import { reserve } from '../resize.js'
import { PROP_CURSOR_SIZE, writePropCursor } from '../cursor.js'
import { writeU8 } from '../uint.js'

export const deleteProp = (ctx: Ctx, def: PropDef) => {
  if (ctx.operation !== UPDATE) {
    return
  }
  reserve(ctx, PROP_CURSOR_SIZE + 1)
  writePropCursor(ctx, def)
  writeU8(ctx, DELETE)
}
