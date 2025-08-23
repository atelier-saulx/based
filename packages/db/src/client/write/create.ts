import { SchemaTypeDef } from '@based/schema/def'
import { Ctx } from './Ctx.js'
import { writeObject } from './writeObject.js'
import { resize } from './resize.js'
import { CREATE, RANGE_ERR, SIZE } from '../modify/types.js'
import {
  writeMainCursor,
  writeNodeCursor,
  writeTypeCursor,
} from './writeCursor.js'
import { getByPath } from '@based/utils'
import { writeMainBuffer, writeMainValue } from './writeMain.js'

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

  ctx.operation = CREATE
  ctx.schema = def

  const lastIndex = ctx.index
  let firstOfType: boolean

  if (!ctx.created.has(def.id)) {
    ctx.max -= 6
    firstOfType = true
  }

  try {
    resize(ctx, ctx.index + SIZE.DEFAULT_CURSOR)
    writeTypeCursor(ctx)
    writeObject(ctx, def.tree, payload)
    if (ctx.index === lastIndex || ctx.schema.mainLen === 0) {
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
    if (firstOfType) {
      ctx.created.set(def.id, def.lastId)
    }
    def.lastId++
  } catch (e) {
    console.log('err:', e)
    if (e === RANGE_ERR) {
      console.log('range error')
    } else {
      throw e
    }
  }
}
