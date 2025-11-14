import { Ctx } from '../Ctx.ts'
import { PropDef } from '@based/schema/def'
import { DELETE, UPDATE } from '../types.ts'
import { reserve } from '../resize.ts'
import { PROP_CURSOR_SIZE, writePropCursor } from '../cursor.ts'
import { writeU8 } from '../uint.ts'

export const deleteProp = (ctx: Ctx, def: PropDef) => {
  if (ctx.operation !== UPDATE) {
    return
  }
  reserve(ctx, PROP_CURSOR_SIZE + 1)
  writePropCursor(ctx, def)
  writeU8(ctx, DELETE)
}
