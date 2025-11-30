import { PROP_CURSOR_SIZE, writeMainCursor } from '../cursor.js'
import { writeU16, writeU8 } from '../uint.js'
import { reserve } from '../resize.js'
import { writeFixed } from './fixed.js'
import { Ctx } from '../Ctx.js'
import { DECREMENT, INCREMENT } from '../types.js'
import type { MainDef } from '@based/schema'

export const writeIncrement = (ctx: Ctx, def: MainDef, val: any) => {
  if (typeof val.increment !== 'number') {
    throw [def, val]
  }
  if (val.increment === 0) {
    return
  }
  reserve(ctx, PROP_CURSOR_SIZE + 4 + def.main.size)
  writeMainCursor(ctx)
  if (val.increment > 0) {
    writeU8(ctx, INCREMENT)
    writeU8(ctx, def.typeIndex)
    writeU16(ctx, def.main.start)
    writeFixed(ctx, def, val.increment)
  } else {
    writeU8(ctx, DECREMENT)
    writeU8(ctx, def.typeIndex)
    writeU16(ctx, def.main.start)
    writeFixed(ctx, def, -val.increment)
  }
}
