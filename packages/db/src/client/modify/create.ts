import { SchemaTypeDef } from '@based/schema/def'
import { Ctx } from './Ctx.js'
import { writeObject } from './write/object.js'
import { resize } from './resize.js'
import { CREATE, RANGE_ERR, SIZE } from '../_modify/types.js'
import {
  writeMainCursor,
  writeNodeCursor,
  writeTypeCursor,
} from './write/cursor.js'
import { getByPath } from '@based/utils'
import { writeMainBuffer, writeMainValue } from './write/main.js'

export function create(ctx: Ctx, typeDef: SchemaTypeDef, payload: any) {
  const intialIndex = ctx.index

  if (!(typeDef.id in ctx.created)) {
    ctx.created[typeDef.id] = 0
    ctx.max -= 6
  }

  payload = typeDef.hooks?.create?.(payload) || payload

  if (payload.id) {
    if (!ctx.unsafe) {
      throw Error('create with "id" is not allowed')
    }
    ctx.id = payload.id
  } else {
    ctx.id = ctx.created[typeDef.id] + 1
  }

  ctx.operation = CREATE
  ctx.schema = typeDef
  ctx.overwrite = true

  try {
    resize(ctx, ctx.index + SIZE.DEFAULT_CURSOR)
    writeTypeCursor(ctx)
    const preWriteIndex = ctx.index
    writeObject(ctx, typeDef.tree, payload)
    if (ctx.index === preWriteIndex || ctx.schema.mainLen === 0) {
      writeMainCursor(ctx)
      writeNodeCursor(ctx)
    }
    if (ctx.schema.createTs) {
      let createTs: number
      for (const prop of ctx.schema.createTs) {
        if (getByPath(payload, prop.path) !== undefined) {
          continue
        }
        createTs ??= Date.now()
        writeMainValue(ctx, prop, createTs)
      }
    } else if (!ctx.schema.mainEmptyAllZeroes) {
      writeMainBuffer(ctx)
    }
    // TODO defaults
    // TODO sort
    ctx.created[typeDef.id]++
  } catch (e) {
    if (e === RANGE_ERR) {
      if (intialIndex === 8) {
        ctx.index = intialIndex
        ctx.current = {}
        throw { msg: 'Out of range. Not enough space for this payload' }
      }
      ctx.index = 8
      ctx.current = {}
      return create.apply(null, arguments)
    } else {
      ctx.index = intialIndex
      ctx.current = {}
      throw e
    }
  }
}
