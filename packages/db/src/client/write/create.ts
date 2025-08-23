import { SchemaTypeDef } from '@based/schema/def'
import { Ctx } from './Ctx.js'
import { writeObject } from './writeObject.js'
import { resize } from './resize.js'
import { SIZE } from '../modify/types.js'

export const create = (ctx: Ctx, def: SchemaTypeDef, payload: any) => {
  payload = def.hooks?.create?.(payload) || payload

  if (payload.id) {
    if (!ctx.unsafe) {
      throw Error('create with "id" is not allowed')
    }
    ctx.id = payload.id
  } else {
    ctx.id = def.lastId + 1
  }

  const lastIndex = ctx.index
  writeObject(ctx, def, payload)
  if (ctx.index === lastIndex || ctx.schema.mainLen === 0) {
    resize(ctx, ctx.index + SIZE.DEFAULT_CURSOR)
  }
}
