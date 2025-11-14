import { getValidSchema, validateId } from '../validate.ts'
import { handleError } from '../error.ts'
import { DbClient } from '../../../index.ts'
import { reserve } from '../resize.ts'
import {
  NODE_CURSOR_SIZE,
  TYPE_CURSOR_SIZE,
  writeTypeCursor,
} from '../cursor.ts'
import { EXPIRE, SWITCH_ID_UPDATE } from '../types.ts'
import { schedule } from '../drain.ts'
import { Tmp } from '../Tmp.ts'
import { writeU32, writeU8 } from '../uint.ts'

export function expire(
  db: DbClient,
  type: string,
  id: number,
  seconds: number,
): Promise<number> {
  const ctx = db.modifyCtx
  const schema = getValidSchema(db, type)
  try {
    ctx.start = ctx.index
    ctx.schema = schema
    validateId(id)
    reserve(ctx, TYPE_CURSOR_SIZE + NODE_CURSOR_SIZE + 5)
    writeTypeCursor(ctx)
    writeU8(ctx, SWITCH_ID_UPDATE)
    writeU32(ctx, id)
    writeU8(ctx, EXPIRE)
    writeU32(ctx, seconds)
    const tmp = new Tmp(ctx)
    schedule(db, ctx)
    return tmp
  } catch (e) {
    return handleError(db, ctx, expire, arguments, e)
  }
}
