import { MICRO_BUFFER } from '@based/schema/def'
import { startDrain, flushBuffer } from '../flushModify.js'
import { setCursor } from './setCursor.js'
import { EXPIRE, SIZE } from './types.js'
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
  if (ctx.len + SIZE.DEFAULT_CURSOR + 5 > ctx.max) {
    void flushBuffer(db)
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
