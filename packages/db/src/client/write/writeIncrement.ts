import { PropDef } from '@based/schema/def'
import { writeUint16 } from '@based/utils'
import { SIZE, INCREMENT, DECREMENT } from '../modify/types.js'
import { Ctx } from './Ctx.js'
import { writeFixed } from './writeFixed.js'
import { resize } from './resize.js'
import { writeMainProp, writeNode, writeType } from './writeCursor.js'

export const writeIncrement = (ctx: Ctx, def: PropDef, val) => {
  if (typeof val.increment !== 'number') {
    throw [def, val]
  }
  if (val.increment === 0) {
    return
  }
  resize(ctx, ctx.index + SIZE.DEFAULT_CURSOR)
  writeType(ctx)
  writeMainProp(ctx)
  writeNode(ctx)
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
  writeFixed(ctx, def, increment, ctx.index + 4)
  ctx.index += def.len + 4
}
