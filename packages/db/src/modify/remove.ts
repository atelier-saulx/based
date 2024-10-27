import { BasedDb } from '../index.js'
import { flushBuffer, startDrain } from '../operations.js'
import { setCursor } from './setCursor.js'
import { UPDATE } from './types.js'
import { appendU8 } from './utils.js'

export const remove = (db: BasedDb, type: string, id: number): boolean => {
  const ctx = db.modifyCtx
  const def = db.schemaTypesParsed[type]
  const separate = def.separate

  if (separate) {
    const size = ctx.len + 12 + separate.length * 12
    if (size > ctx.max) {
      if (ctx.max > size) {
        flushBuffer(db)
        return remove(db, type, id)
      } else {
        throw Error('Not enough allocated space for removal')
      }
    }
    setCursor(ctx, def, 0, id, UPDATE)
    appendU8(ctx, 4)
    for (const s of separate) {
      setCursor(ctx, def, s.prop, id, UPDATE)
      appendU8(ctx, 4)
    }
    appendU8(ctx, 10)
  } else {
    if (ctx.len + 12 > ctx.max) {
      if (ctx.max > 12) {
        flushBuffer(db)
        return remove(db, type, id)
      } else {
        throw Error('Not enough allocated space for removal')
      }
    }
    setCursor(ctx, def, 0, id, UPDATE)
    appendU8(ctx, 4)
    appendU8(ctx, 10)
  }

  if (!db.isDraining) {
    startDrain(db)
  }

  return true
}
