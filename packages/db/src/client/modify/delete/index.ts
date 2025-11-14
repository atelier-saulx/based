import { DbClient } from '../../../index.ts'
import { getValidSchema, validateId } from '../validate.ts'
import {
  FULL_CURSOR_SIZE,
  writeMainCursor,
  writePropCursor,
  writeTypeCursor,
} from '../cursor.js'
import { reserve } from '../resize.ts'
import {
  DELETE_NODE,
  DELETE_SORT_INDEX,
  SWITCH_ID_UPDATE,
  UPDATE,
} from '../types.js'
import { writeU32, writeU8 } from '../uint.ts'
import { handleError } from '../error.ts'
import { Tmp } from '../Tmp.ts'
import { schedule } from '../drain.ts'

export function del(db: DbClient, type: string, id: number) {
  const schema = getValidSchema(db, type)
  const ctx = db.modifyCtx
  try {
    if (schema.insertOnly) {
      throw `This type is insertOnly`
    }

    ctx.start = ctx.index
    ctx.schema = schema
    ctx.operation = UPDATE

    validateId(id)
    reserve(ctx, FULL_CURSOR_SIZE + 2 + schema.separate.length * 12) // 12 too much?
    writeTypeCursor(ctx)
    writeU8(ctx, SWITCH_ID_UPDATE)
    writeU32(ctx, id)
    writeMainCursor(ctx)
    writeU8(ctx, DELETE_SORT_INDEX)
    for (const def of schema.separate) {
      writePropCursor(ctx, def)
      writeU8(ctx, DELETE_SORT_INDEX)
    }
    writeU8(ctx, DELETE_NODE)
    const tmp = new Tmp(ctx)
    schedule(db, ctx)
    return tmp
  } catch (e) {
    return handleError(db, ctx, del, arguments, e)
  }
}
