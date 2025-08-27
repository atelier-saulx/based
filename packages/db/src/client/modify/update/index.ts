import { SchemaTypeDef } from '@based/schema/def'
import { Ctx } from '../Ctx.js'
import { ModifyOpts, UPDATE, UPDATE_PARTIAL } from '../types.js'
import { DbClient, DbClientHooks } from '../../../index.js'
import { validateId, validatePayload } from '../validate.js'
import { isValidId, langCodesMap } from '@based/schema'
import { handleError } from '../error.js'
import { Tmp } from '../Tmp.js'
import { writeObject } from '../props/object.js'
import { reserve } from '../resize.js'
import {
  FULL_CURSOR_SIZE,
  PROP_CURSOR_SIZE,
  writeMainCursor,
  writeNodeCursor,
  writeTypeCursor,
} from '../cursor.js'
import { getByPath, writeUint32 } from '@based/utils'
import { writeU16, writeU8 } from '../uint.js'
import { writeFixed } from '../props/fixed.js'
import { schedule } from '../drain.js'

const writeUpdateTs = (ctx: Ctx, payload: any) => {
  if (ctx.schema.updateTs) {
    const updateTs = Date.now()
    for (const def of ctx.schema.updateTs) {
      if (getByPath(payload, def.path) !== undefined) {
        continue
      }
      ctx.main.set(def, updateTs)
    }
  }
}

const writeMergeMain = (ctx: Ctx) => {
  if (ctx.main.size) {
    reserve(ctx, PROP_CURSOR_SIZE + 5 + ctx.main.size * 4)
    writeMainCursor(ctx)
    writeU8(ctx, UPDATE_PARTIAL)
    const index = ctx.index
    ctx.index += 4
    const start = ctx.index
    for (const [def, val] of ctx.main) {
      writeU16(ctx, def.start)
      writeU16(ctx, def.len)
      writeFixed(ctx, def, val)
    }
    writeUint32(ctx.array, ctx.index - start, index)
  }
}

const writeUpdate = (ctx: Ctx, payload: any) => {
  reserve(ctx, FULL_CURSOR_SIZE)
  writeTypeCursor(ctx)
  writeNodeCursor(ctx)
  writeObject(ctx, ctx.schema.tree, payload)
  writeUpdateTs(ctx, payload)
  writeMergeMain(ctx)
}

export function update(
  db: DbClient,
  type: string,
  id: number,
  payload: any,
  opts: ModifyOpts,
): Promise<number> {
  const schema = db.schemaTypesParsed[type]
  const ctx = db.modifyCtx
  try {
    validatePayload(payload)
    validateId(id)

    if (schema.hooks?.update) {
      payload = schema.hooks.update(payload) || payload
    }

    ctx.id = id
    ctx.schema = schema
    ctx.operation = UPDATE
    ctx.overwrite = opts?.overwrite
    ctx.locale = opts?.locale && langCodesMap.get(opts.locale)
    ctx.start = ctx.index

    if (ctx.main.size) {
      ctx.main.clear()
    }

    writeUpdate(ctx, payload)
    const tmp = new Tmp(ctx, id)
    schedule(db, ctx)
    return tmp
  } catch (e) {
    return handleError(db, ctx, update, arguments, e)
  }
}
