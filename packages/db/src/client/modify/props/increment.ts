import { PROP_CURSOR_SIZE, writeMainCursor } from '../cursor.ts'
import { writeU16, writeU8 } from '../uint.ts'
import type { PropDef } from '@based/schema/def'
import { reserve } from '../resize.ts'
import { writeFixed } from './fixed.ts'
import { Ctx } from '../Ctx.ts'
import { DECREMENT, INCREMENT } from '../types.ts'

export const writeIncrement = (ctx: Ctx, def: PropDef, val: any) => {
  if (typeof val.increment !== 'number') {
    throw [def, val]
  }
  if (val.increment === 0) {
    return
  }
  reserve(ctx, PROP_CURSOR_SIZE + 4 + def.len)
  writeMainCursor(ctx)
  if (val.increment > 0) {
    writeU8(ctx, INCREMENT)
    writeU8(ctx, def.typeIndex)
    writeU16(ctx, def.start)
    writeFixed(ctx, def, val.increment)
  } else {
    writeU8(ctx, DECREMENT)
    writeU8(ctx, def.typeIndex)
    writeU16(ctx, def.start)
    writeFixed(ctx, def, -val.increment)
  }
}
