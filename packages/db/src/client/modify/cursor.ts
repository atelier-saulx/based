import { MICRO_BUFFER, PropDef } from '@based/schema/def'
import { Ctx } from './Ctx.js'
import {
  SWITCH_TYPE,
  SWITCH_FIELD,
  SWITCH_ID_CREATE,
  SWITCH_ID_UPDATE,
  SWITCH_ID_CREATE_UNSAFE,
  UPDATE,
  CREATE,
} from './types.js'
import { writeU32, writeU8, writeU8Array } from './uint.js'

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
    ctx.cursor.main = null
    ctx.cursor.prop = null
    ctx.cursor.id = null
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

export const writeNodeCursor = (ctx: Ctx) => {
  if (ctx.id !== ctx.cursor.id || ctx.operation !== ctx.cursor.operation) {
    // TODO maybe check if toggling between unsafe and safe
    if (ctx.operation !== CREATE) {
      writeU8(ctx, SWITCH_ID_UPDATE)
      writeU32(ctx, ctx.id)
    } else if (ctx.unsafe) {
      writeU8(ctx, SWITCH_ID_CREATE_UNSAFE)
      writeU32(ctx, ctx.id)
    } else {
      writeU8(ctx, SWITCH_ID_CREATE)
    }
    ctx.cursor.id = ctx.id
    ctx.cursor.main = null
    ctx.cursor.operation = ctx.operation
  }
}
