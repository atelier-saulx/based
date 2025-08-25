import { PropDef } from '@based/schema/def'
import { writeUint32 } from '@based/utils'
import { SIZE } from '../../_modify/types.js'
import { Ctx } from '../Ctx.js'
import { writeFixedAtOffset } from './fixed.js'
import { reserve } from '../resize.js'
import { writeMainCursor } from './cursor.js'

export const writeMainBuffer = (ctx: Ctx) => {
  if (ctx.cursor.main === null) {
    writeMainCursor(ctx)
    ctx.array[ctx.index] = ctx.operation
    writeUint32(ctx.array, ctx.schema.mainLen, ctx.index + 1)
    ctx.cursor.main = ctx.index + 5
    ctx.array.set(ctx.schema.mainEmpty, ctx.cursor.main)
    ctx.index += ctx.schema.mainLen + 5
  }
}

export const writeMainValue = (ctx: Ctx, def: PropDef, val: any) => {
  reserve(ctx, SIZE.DEFAULT_CURSOR + 5 + ctx.schema.mainLen)
  writeMainBuffer(ctx)
  writeFixedAtOffset(
    ctx,
    def,
    typeof val === 'object' && val !== null && 'increment' in val
      ? val.increment
      : val,
    ctx.cursor.main + def.start,
  )
}
