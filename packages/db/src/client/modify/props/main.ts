import { PropDef } from '@based/schema/def'
import { Ctx } from '../Ctx.ts'
import { writeFixedAtOffset } from './fixed.ts'
import { reserve } from '../resize.ts'
import { PROP_CURSOR_SIZE, writeMainCursor } from '../cursor.ts'
import { writeU32, writeU8, writeU8Array } from '../uint.ts'

export const writeMainBuffer = (ctx: Ctx) => {
  if (ctx.cursor.main === null) {
    reserve(ctx, PROP_CURSOR_SIZE + 5 + ctx.schema.mainLen)
    writeMainCursor(ctx)
    writeU8(ctx, ctx.operation)
    writeU32(ctx, ctx.schema.mainLen)
    ctx.cursor.main = ctx.index
    writeU8Array(ctx, ctx.schema.mainEmpty)
  }
}

export const writeMainValue = (ctx: Ctx, def: PropDef, val: any) => {
  reserve(ctx, PROP_CURSOR_SIZE + 5 + ctx.schema.mainLen)
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
