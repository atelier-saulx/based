import { MICRO_BUFFER, PropDef } from '@based/schema/def'
import { writeUint32 } from '@based/utils'
import {
  SWITCH_TYPE,
  SWITCH_FIELD,
  CREATE,
  SWITCH_ID_CREATE,
  SWITCH_ID_UPDATE,
} from '../modify/types.js'
import { Ctx } from './Ctx.js'

export const writeTypeCursor = (ctx: Ctx) => {
  if (ctx.schema.id !== ctx.current.schema) {
    ctx.array[ctx.index] = SWITCH_TYPE // switch node type
    ctx.array.set(ctx.schema.idUint8, ctx.index + 1)
    ctx.index += 3
    ctx.current.schema = ctx.schema.id
    ctx.current.main = null
    ctx.current.prop = null
    ctx.current.id = null
  }
}

export const writeProp = (ctx: Ctx, def: PropDef) => {
  if (def.prop !== ctx.current.prop) {
    ctx.array[ctx.index] = SWITCH_FIELD
    ctx.array[ctx.index + 1] = def.prop
    ctx.array[ctx.index + 2] = def.typeIndex
    ctx.index += 3
    ctx.current.prop = def.prop
  }
}

export const writeMainCursor = (ctx: Ctx) => {
  if (ctx.current.prop !== 0) {
    ctx.array[ctx.index] = SWITCH_FIELD
    ctx.array[ctx.index + 1] = 0
    ctx.array[ctx.index + 2] = MICRO_BUFFER
    ctx.index += 3
    ctx.current.prop = 0
  }
}

export const writeNodeCursor = (ctx: Ctx) => {
  if (ctx.id !== ctx.current.id) {
    ctx.array[ctx.index] =
      ctx.operation === CREATE ? SWITCH_ID_CREATE : SWITCH_ID_UPDATE // swtch id
    writeUint32(ctx.array, ctx.id, ctx.index + 1)
    ctx.index += 5
    ctx.current.id = ctx.id
    ctx.current.main = null
  }
}
