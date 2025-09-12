import { MICRO_BUFFER, PropDef } from '@based/schema/def'
import { writeUint32 } from '@based/utils'
import { Ctx } from './Ctx.js'
import {
  SWITCH_TYPE,
  SWITCH_FIELD,
  CREATE,
  SWITCH_ID_CREATE,
  SWITCH_ID_UPDATE,
} from './types.js'

export const TYPE_CURSOR_SIZE = 3
export const PROP_CURSOR_SIZE = 3
export const NODE_CURSOR_SIZE = 5
export const FULL_CURSOR_SIZE =
  TYPE_CURSOR_SIZE + NODE_CURSOR_SIZE + PROP_CURSOR_SIZE

export const writeTypeCursor = (ctx: Ctx) => {
  if (ctx.schema.id !== ctx.cursor.type) {
    ctx.array[ctx.index] = SWITCH_TYPE // switch node type
    ctx.array.set(ctx.schema.idUint8, ctx.index + 1)
    ctx.index += 3
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
    ctx.array[ctx.index] = SWITCH_FIELD
    ctx.array[ctx.index + 1] = def.prop
    ctx.array[ctx.index + 2] = typeIndex
    ctx.index += 3
    ctx.cursor.prop = def.prop
  }
}

export const writeMainCursor = (ctx: Ctx) => {
  if (ctx.cursor.prop !== 0) {
    ctx.array[ctx.index] = SWITCH_FIELD
    ctx.array[ctx.index + 1] = 0
    ctx.array[ctx.index + 2] = MICRO_BUFFER
    ctx.index += 3
    ctx.cursor.prop = 0
  }
}

export const writeNodeCursor = (ctx: Ctx) => {
  if (ctx.id !== ctx.cursor.id || ctx.operation !== ctx.cursor.operation) {
    ctx.array[ctx.index] =
      ctx.operation === CREATE ? SWITCH_ID_CREATE : SWITCH_ID_UPDATE // swtch id
    writeUint32(ctx.array, ctx.id, ctx.index + 1)
    ctx.index += 5
    ctx.cursor.id = ctx.id
    ctx.cursor.main = null
    ctx.cursor.operation = ctx.operation
  }
}
