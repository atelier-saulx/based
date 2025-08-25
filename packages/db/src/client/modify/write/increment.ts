import { PropDef } from '@based/schema/def'
import { writeUint16 } from '@based/utils'
import { SIZE, INCREMENT, DECREMENT } from '../../_modify/types.js'
import { Ctx } from '../Ctx.js'
import { writeFixedAtOffset } from './fixed.js'
import { reserve } from '../resize.js'
import { writeMainCursor, writeNodeCursor, writeTypeCursor } from './cursor.js'

export const writeIncrement = (ctx: Ctx, def: PropDef, val) => {
  if (typeof val.increment !== 'number') {
    throw [def, val]
  }
  if (val.increment === 0) {
    return
  }
  reserve(ctx, SIZE.DEFAULT_CURSOR)
  writeMainCursor(ctx)
  let increment: number, operation: number
  if (val.increment > 0) {
    increment = val.increment
    operation = INCREMENT
  } else {
    increment = -val.increment
    operation = DECREMENT
  }
  ctx.array[ctx.index] = operation
  ctx.array[ctx.index + 1] = def.typeIndex
  writeUint16(ctx.array, def.start, ctx.index + 2)
  writeFixedAtOffset(ctx, def, increment, ctx.index + 4)
  ctx.index += def.len + 4
}
