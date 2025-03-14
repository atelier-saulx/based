import { DbClient } from '../index.js'
import { flushBuffer, startDrain } from '../operations.js'
import { setCursor } from './setCursor.js'
import { UPDATE, DELETE_SORT_INDEX, DELETE_NODE, SIZE } from './types.js'
import { MICRO_BUFFER } from '@based/schema/def'

export const deleteFn = (db: DbClient, type: string, id: number): boolean => {
  const ctx = db.modifyCtx
  const schema = db.schemaTypesParsed[type]
  const separate = schema.separate
  // TODO: pretty slow actually
  if (separate) {
    const size = SIZE.DEFAULT_CURSOR + 2 + separate.length * 12
    if (ctx.len + size > ctx.max) {
      flushBuffer(db)
      return deleteFn(db, type, id)
    }
    setCursor(ctx, schema, 0, MICRO_BUFFER, id, UPDATE)
    ctx.buf[ctx.len++] = DELETE_SORT_INDEX
    for (const s of separate) {
      setCursor(ctx, schema, s.prop, s.typeIndex, id, UPDATE)
      ctx.buf[ctx.len++] = DELETE_SORT_INDEX
    }
    ctx.buf[ctx.len++] = DELETE_NODE
  } else {
    if (ctx.len + SIZE.DEFAULT_CURSOR + 2 > ctx.max) {
      flushBuffer(db)
      return deleteFn(db, type, id)
    }
    setCursor(ctx, schema, 0, MICRO_BUFFER, id, UPDATE)
    ctx.buf[ctx.len++] = DELETE_SORT_INDEX
    ctx.buf[ctx.len++] = DELETE_NODE
  }

  if (!db.isDraining) {
    startDrain(db)
  }

  return true
}
