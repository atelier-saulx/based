import { PropDef } from '@based/schema/def'
import { writeUint32 } from '@based/utils'
import { SIZE } from '../modify/types.js'
import { Ctx } from './Ctx.js'
import { writeFixed } from './writeFixed.js'
import { resize } from './resize.js'
import { writeMainProp, writeNode, writeType } from './writeCursor.js'

export const writeMain = (ctx: Ctx, def: PropDef, val: any) => {
  resize(ctx, ctx.index + SIZE.DEFAULT_CURSOR + 5 + ctx.schema.mainLen)
  writeType(ctx)
  writeNode(ctx)
  if (ctx.current.main === null) {
    writeMainProp(ctx)
    ctx.array[ctx.index] = ctx.operation
    writeUint32(ctx.array, ctx.schema.mainLen, ctx.index + 1)
    ctx.array.set(ctx.schema.mainEmpty, ctx.index + 5)
    ctx.index += ctx.schema.mainLen + 5
  }
  writeFixed(
    ctx,
    def,
    typeof val === 'object' && val !== null && 'increment' in val
      ? val.increment
      : val,
    ctx.current.main + def.start,
  )
}
