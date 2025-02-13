import { BasedDb } from '../../index.js'
import { DbClient } from '../index.js'
import { flushBuffer, startDrain } from '../operations.js'
import { setCursor } from './setCursor.js'
import { UPDATE } from './types.js'
import { MICRO_BUFFER } from '../../server/schema/schema.js'

export const deleteFn = (db: DbClient, type: string, id: number): boolean => {
  const ctx = db.modifyCtx
  const schema = db.schemaTypesParsed[type]
  const separate = schema.separate

  if (separate) {
    const size = 12 + separate.length * 12
    if (ctx.len + size > ctx.max) {
      flushBuffer(db)
      return deleteFn(db, type, id)
    }

    setCursor(ctx, schema, 0, MICRO_BUFFER, id, UPDATE)
    ctx.buf[ctx.len++] = 4

    for (const s of separate) {
      setCursor(ctx, schema, s.prop, s.typeIndex, id, UPDATE)
      ctx.buf[ctx.len++] = 4
    }
    ctx.buf[ctx.len++] = 10
  } else {
    if (ctx.len + 12 > ctx.max) {
      flushBuffer(db)
      return deleteFn(db, type, id)
    }
    setCursor(ctx, schema, 0, MICRO_BUFFER, id, UPDATE)
    ctx.buf[ctx.len++] = 4
    ctx.buf[ctx.len++] = 10
  }

  if (!db.isDraining) {
    startDrain(db)
  }

  return true
}
