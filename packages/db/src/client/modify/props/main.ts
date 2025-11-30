import { Ctx } from '../Ctx.js'
import { writeFixedAtOffset } from './fixed.js'
import { reserve } from '../resize.js'
import { PROP_CURSOR_SIZE, writeMainCursor } from '../cursor.js'
import { writePadding, writeU32, writeU8 } from '../uint.js'
import type { MainDef } from '@based/schema'

export const writeMainBuffer = (ctx: Ctx) => {
  if (ctx.cursor.main === null) {
    reserve(ctx, PROP_CURSOR_SIZE + 5 + ctx.typeDef.size)
    writeMainCursor(ctx)
    writeU8(ctx, ctx.operation)
    writeU32(ctx, ctx.typeDef.size)
    ctx.cursor.main = ctx.index
    writePadding(ctx, ctx.typeDef.size)
    // writeU8Array(ctx, ctx.typeDef.mainEmpty)
  }
}

export const writeMainValue = (ctx: Ctx, def: MainDef, val: any) => {
  reserve(ctx, PROP_CURSOR_SIZE + 5 + ctx.typeDef.size)
  writeMainBuffer(ctx)
  writeFixedAtOffset(
    ctx,
    def,
    typeof val === 'object' && val !== null && 'increment' in val
      ? val.increment
      : val,
    ctx.cursor.main + def.main.start,
  )
}
