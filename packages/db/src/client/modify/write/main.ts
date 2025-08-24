import { PropDef } from '@based/schema/def'
import { writeUint32 } from '@based/utils'
import { SIZE } from '../../_modify/types.js'
import { Ctx } from '../Ctx.js'
import { writeFixedAtOffset } from './fixed.js'
import { resize } from '../resize.js'
import { writeMainCursor, writeNodeCursor, writeTypeCursor } from './cursor.js'

export const writeMainBuffer = (ctx: Ctx) => {
  if (ctx.current.main === null) {
    writeMainCursor(ctx)
    writeNodeCursor(ctx)
    ctx.array[ctx.index] = ctx.operation
    writeUint32(ctx.array, ctx.schema.mainLen, ctx.index + 1)
    ctx.current.main = ctx.index + 5
    ctx.array.set(ctx.schema.mainEmpty, ctx.current.main)
    ctx.index += ctx.schema.mainLen + 5
  }
}

export const writeMainValue = (ctx: Ctx, def: PropDef, val: any) => {
  resize(ctx, ctx.index + SIZE.DEFAULT_CURSOR + 5 + ctx.schema.mainLen)
  writeTypeCursor(ctx)
  writeMainBuffer(ctx)
  writeFixedAtOffset(
    ctx,
    def,
    typeof val === 'object' && val !== null && 'increment' in val
      ? val.increment
      : val,
    ctx.current.main + def.start,
  )
}
