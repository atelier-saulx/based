import { MICRO_BUFFER, PropDef } from '@based/schema/def'
import { Ctx } from './Ctx.ts'
import { SWITCH_TYPE, SWITCH_FIELD } from './types.js'
import { writeU8, writeU8Array } from './uint.ts'

export const TYPE_CURSOR_SIZE = 3
export const PROP_CURSOR_SIZE = 3
export const NODE_CURSOR_SIZE = 5
export const FULL_CURSOR_SIZE =
  TYPE_CURSOR_SIZE + NODE_CURSOR_SIZE + PROP_CURSOR_SIZE

export const writeTypeCursor = (ctx: Ctx) => {
  if (ctx.schema.id !== ctx.cursor.type) {
    writeU8(ctx, SWITCH_TYPE)
    writeU8Array(ctx, ctx.schema.idUint8)
    ctx.cursor.type = ctx.schema.id
    ctx.cursor.prop = null
  }
}

export const writePropCursor = (
  ctx: Ctx,
  def: PropDef,
  typeIndex = def.typeIndex,
) => {
  if (def.prop !== ctx.cursor.prop) {
    writeU8(ctx, SWITCH_FIELD)
    writeU8(ctx, def.prop)
    writeU8(ctx, typeIndex)
    ctx.cursor.prop = def.prop
  }
}

export const writeMainCursor = (ctx: Ctx) => {
  if (ctx.cursor.prop !== 0) {
    writeU8(ctx, SWITCH_FIELD)
    writeU8(ctx, 0)
    writeU8(ctx, MICRO_BUFFER)
    ctx.cursor.prop = 0
  }
}
