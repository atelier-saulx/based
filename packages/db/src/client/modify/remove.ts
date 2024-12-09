import { BasedDb } from '../../index.js'
import { flushBuffer, startDrain } from '../operations.js'
import { setCursor } from './setCursor.js'
import { UPDATE } from './types.js'
import { appendU8, outOfRange } from './utils.js'

export const remove = (db: BasedDb, type: string, id: number): boolean => {
  const ctx = db.modifyCtx
  const schema = db.schemaTypesParsed[type]
  const separate = schema.separate

  ctx.db.markNodeDirty(schema, id)

  if (separate) {
    const size = 12 + separate.length * 12
    if (outOfRange(ctx, size)) {
      flushBuffer(db)
      return remove(db, type, id)
    }
    setCursor(ctx, 0, id, UPDATE)
    appendU8(ctx, 4)
    for (const s of separate) {
      setCursor(ctx, s.prop, id, UPDATE)
      appendU8(ctx, 4)
    }
    appendU8(ctx, 10)
  } else {
    if (outOfRange(ctx, 12)) {
      flushBuffer(db)
      return remove(db, type, id)
    }
    setCursor(ctx, 0, id, UPDATE)
    appendU8(ctx, 4)
    appendU8(ctx, 10)
  }

  if (!db.isDraining) {
    startDrain(db)
  }

  return true
}
