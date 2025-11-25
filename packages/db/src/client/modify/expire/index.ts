import { getValidSchema, validateId } from '../validate.js'
import { handleError } from '../error.js'
import { DbClient } from '../../../index.js'
import { reserve } from '../resize.js'
import {
  NODE_CURSOR_SIZE,
  TYPE_CURSOR_SIZE,
  writeTypeCursor,
} from '../cursor.js'
import { schedule } from '../drain.js'
import { Tmp } from '../Tmp.js'
import { writeU32, writeU8 } from '../uint.js'
import { ModOp } from '../../../zigTsExports.js'

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
    writeU8(ctx, ModOp.switchIdUpdate)
    writeU32(ctx, id)
    writeU8(ctx, ModOp.expire)
    writeU32(ctx, seconds)
    const tmp = new Tmp(ctx)
    schedule(db, ctx)
    return tmp
  } catch (e) {
    return handleError(db, ctx, expire, arguments, e)
  }
}
