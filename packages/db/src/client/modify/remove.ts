import { BasedDb } from '../../index.js'
import { flushBuffer, startDrain } from '../operations.js'
import { setCursor } from './setCursor.js'
import { UPDATE } from './types.js'

export const remove = (db: BasedDb, type: string, id: number): boolean => {
  const ctx = db.modifyCtx
  const schema = db.schemaTypesParsed[type]
  const separate = schema.separate

  ctx.db.markNodeDirty(schema, id)

  if (separate) {
    const size = 12 + separate.length * 12
    if (ctx.len + size > ctx.max) {
      flushBuffer(db)
      return remove(db, type, id)
    }

    setCursor(ctx, schema, 0, id, UPDATE)
    ctx.buf[ctx.len++] = 4

    for (const s of separate) {
      setCursor(ctx, schema, s.prop, id, UPDATE)
      ctx.buf[ctx.len++] = 4
    }
    ctx.buf[ctx.len++] = 10
  } else {
    if (ctx.len + 12 > ctx.max) {
      flushBuffer(db)
      return remove(db, type, id)
    }
    setCursor(ctx, schema, 0, id, UPDATE)
    ctx.buf[ctx.len++] = 4
    ctx.buf[ctx.len++] = 10
  }

  if (!db.isDraining) {
    startDrain(db)
  }

  return true
}
