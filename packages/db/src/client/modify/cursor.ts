import { Ctx } from './Ctx.js'
import { writeU16, writeU8 } from './uint.js'
import { SWITCH_TYPE, SWITCH_FIELD } from './types.js'
import { typeMap, type LeafDef } from '@based/schema'

export const TYPE_CURSOR_SIZE = 3
export const PROP_CURSOR_SIZE = 3
export const NODE_CURSOR_SIZE = 5
export const FULL_CURSOR_SIZE =
  TYPE_CURSOR_SIZE + NODE_CURSOR_SIZE + PROP_CURSOR_SIZE

export const writeTypeCursor = (ctx: Ctx) => {
  if (ctx.typeDef.id !== ctx.cursor.type) {
    writeU8(ctx, SWITCH_TYPE)
    writeU16(ctx, ctx.typeDef.id) // is this correct?
    ctx.cursor.type = ctx.typeDef.id
    ctx.cursor.prop = undefined
  }
}

export const writePropCursor = (
  ctx: Ctx,
  def: LeafDef,
  typeEnum = def.typeEnum,
) => {
  if (def.id !== ctx.cursor.prop) {
    writeU8(ctx, SWITCH_FIELD)
    writeU8(ctx, def.id)
    writeU8(ctx, typeEnum)
    ctx.cursor.prop = def.id
  }
}

export const writeMainCursor = (ctx: Ctx) => {
  if (ctx.cursor.prop !== 0) {
    writeU8(ctx, SWITCH_FIELD)
    writeU8(ctx, 0)
    writeU8(ctx, typeMap.microbuffer)
    ctx.cursor.prop = 0
  }
}
