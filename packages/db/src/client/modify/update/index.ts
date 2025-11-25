import { Ctx } from '../Ctx.js'
import { ModifyOpts } from '../types.js'
import { DbClient } from '../../../db.js'
import { getValidSchema, validateId, validatePayload } from '../validate.js'
import { handleError } from '../error.js'
import { Tmp } from '../Tmp.js'
import { writeObject } from '../props/object.js'
import { reserve } from '../resize.js'
import {
  FULL_CURSOR_SIZE,
  PROP_CURSOR_SIZE,
  writeMainCursor,
  writeTypeCursor,
} from '../cursor.js'
import { writeU16, writeU32, writeU8 } from '../uint.js'
import { writeFixed } from '../props/fixed.js'
import { schedule } from '../drain.js'
import { ModOp } from '../../../zigTsExports.js'
import { langCodesMap, type SchemaTypeDef } from '../../../schema/index.js'
import { getByPath } from '../../../utils/path.js'
import { writeUint32 } from '../../../utils/uint8.js'

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
    writeU8(ctx, ModOp.updatePartial)
    const index = ctx.index
    ctx.index += 4
    const start = ctx.index
    for (const [def, val] of ctx.main) {
      writeU16(ctx, def.start)
      writeU16(ctx, def.len)
      writeFixed(ctx, def, val)
    }
    writeUint32(ctx.buf, ctx.index - start, index)
  }
}

export const writeUpdate = (
  ctx: Ctx,
  schema: SchemaTypeDef,
  id: number,
  payload: any,
  opts?: ModifyOpts,
) => {
  validatePayload(payload)

  if (schema.propHooks?.update) {
    for (const def of schema.propHooks.update) {
      let val = payload
      let obj: any
      let key: string
      for (key of def.path) {
        obj = val
        val = val?.[key]
      }
      if (val !== undefined) {
        obj[key!] = def.hooks!.update!(val, obj)
      }
    }
  }

  if (schema.hooks?.update) {
    payload = schema.hooks.update(payload) || payload
  }

  ctx.schema = schema
  ctx.operation = ModOp.updateProp
  ctx.locale = (opts?.locale && langCodesMap.get(opts.locale)) || 0

  if (ctx.main.size) {
    ctx.main.clear()
  }

  reserve(ctx, FULL_CURSOR_SIZE)
  writeTypeCursor(ctx)
  writeU8(ctx, ModOp.switchIdUpdate)
  writeU32(ctx, id)
  writeObject(ctx, ctx.schema.tree, payload)
  writeUpdateTs(ctx, payload)
  writeMergeMain(ctx)
}

export function update(
  db: DbClient,
  type: string,
  id: number,
  payload: any,
  opts?: ModifyOpts,
): Promise<number> {
  const schema = getValidSchema(db, type)
  const ctx = db.modifyCtx
  ctx.start = ctx.index
  try {
    validateId(id)
    writeUpdate(ctx, schema, id, payload, opts)
    const tmp = new Tmp(ctx)
    schedule(db, ctx)
    return tmp
  } catch (e) {
    return handleError(db, ctx, update, arguments, e)
  }
}
