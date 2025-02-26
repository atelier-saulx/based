import { MICRO_BUFFER } from '@based/schema/def'
import { startDrain, flushBuffer } from '../operations.js'
import { setCursor } from './setCursor.js'
import { EXPIRE } from './types.js'
import { DbClient } from '../index.js'

export type CreateObj = Record<string, any>

export function expire(
  db: DbClient,
  type: string,
  id: number,
  seconds: number,
) {
  const def = db.schemaTypesParsed[type]

  if (!def) {
    throw new Error(
      `Unknown type: ${type}. Did you mean on of: ${Object.keys(db.schemaTypesParsed).join(', ')}`,
    )
  }

  const ctx = db.modifyCtx
  if (ctx.len + 8 + 1 + 4 > ctx.max) {
    flushBuffer(db)
    return expire(db, type, id, seconds)
  }

  setCursor(ctx, def, 0, MICRO_BUFFER, id, EXPIRE)

  ctx.buf[ctx.len++] = EXPIRE
  ctx.buf[ctx.len++] = seconds
  ctx.buf[ctx.len++] = seconds >>>= 8
  ctx.buf[ctx.len++] = seconds >>>= 8
  ctx.buf[ctx.len++] = seconds >>>= 8

  if (!db.isDraining) {
    startDrain(db)
  }
}
