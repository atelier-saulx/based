import { DbClient } from '../../../db.js'
import { getValidSchema, validateId } from '../validate.js'
import {
  FULL_CURSOR_SIZE,
  writeMainCursor,
  writePropCursor,
  writeTypeCursor,
} from '../cursor.js'
import { reserve } from '../resize.js'
import { writeU32, writeU8 } from '../uint.js'
import { handleError } from '../error.js'
import { Tmp } from '../Tmp.js'
import { schedule } from '../drain.js'
import { ModOp } from '../../../zigTsExports.js'

export function del(db: DbClient, type: string, id: number) {
  const schema = getValidSchema(db, type)
  const ctx = db.modifyCtx
  try {
    if (schema.insertOnly) {
      throw `This type is insertOnly`
    }

    ctx.start = ctx.index
    ctx.schema = schema
    ctx.operation = ModOp.updateProp

    validateId(id)
    reserve(ctx, FULL_CURSOR_SIZE + 2 + schema.separate.length * 12) // 12 too much?
    writeTypeCursor(ctx)
    writeU8(ctx, ModOp.switchIdUpdate)
    writeU32(ctx, id)
    writeMainCursor(ctx)
    writeU8(ctx, ModOp.deleteSortIndex)
    for (const def of schema.separate) {
      writePropCursor(ctx, def)
      writeU8(ctx, ModOp.deleteSortIndex)
    }
    writeU8(ctx, ModOp.deleteNode)
    const tmp = new Tmp(ctx)
    schedule(db, ctx)
    return tmp
  } catch (e) {
    return handleError(db, ctx, del, arguments, e)
  }
}
