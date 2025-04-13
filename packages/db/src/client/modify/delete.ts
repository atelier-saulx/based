import { DbClient } from '../index.js'
import { flushBuffer, startDrain } from '../flushModify.js'
import { ModifyRes, ModifyState } from './ModifyRes.js'
import { setCursor } from './setCursor.js'
import {
  UPDATE,
  DELETE_SORT_INDEX,
  DELETE_NODE,
  SIZE,
  ModifyOpts,
} from './types.js'
import { MICRO_BUFFER } from '@based/schema/def'

export const deleteFn = (
  db: DbClient,
  type: string,
  id: number,
  opts?: ModifyOpts,
): ModifyRes => {
  const def = db.schemaTypesParsed[type]

  if (!def) {
    throw new Error(
      `Unknown type: ${type}. Did you mean on of: ${Object.keys(db.schemaTypesParsed).join(', ')}`,
    )
  }

  const ctx = db.modifyCtx
  const res = new ModifyState(def.id, id, db, opts)

  const schema = db.schemaTypesParsed[type]
  const separate = schema.separate
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

  // @ts-ignore
  return res
}
