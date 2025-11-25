import { Ctx } from '../Ctx.js'
import { reserve } from '../resize.js'
import { PROP_CURSOR_SIZE, writePropCursor } from '../cursor.js'
import { writeU8 } from '../uint.js'
import { ModOp } from '../../../zigTsExports.js'
import type { PropDef } from '../../../schema/index.js'

export const deleteProp = (ctx: Ctx, def: PropDef) => {
  if (ctx.operation !== ModOp.updateProp) {
    return
  }
  reserve(ctx, PROP_CURSOR_SIZE + 1)
  writePropCursor(ctx, def)
  writeU8(ctx, ModOp.delete)
}
