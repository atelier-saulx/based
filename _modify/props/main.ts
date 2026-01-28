import { Ctx } from '../Ctx.js'
import { writeFixedAtOffset } from './fixed.js'
import { reserve } from '../resize.js'
import { PROP_CURSOR_SIZE, writeMainCursor } from '../cursor.js'
import { writeU32, writeU8, writeU8Array } from '../uint.js'
import type { PropDef } from '../../../schema/index.js'

export const writeMainBuffer = (ctx: Ctx) => {
  if (ctx.cursor.main === undefined) {
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
    (ctx.cursor.main ?? 0) + def.start,
  )
}
