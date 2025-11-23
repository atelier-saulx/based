import { DbClient } from '../../../index.js'
import { ModifyOpts } from '../types.js'
import { getValidSchema } from '../validate.js'
import { writeU32, writeU8, writeU8Array } from '../uint.js'
import { reserve } from '../resize.js'
import { Ctx } from '../Ctx.js'
import { ENCODER, writeUint32 } from '@based/utils'
import { writeCreate } from '../create/index.js'
import { handleError } from '../error.js'
import { writeUpdate } from '../update/index.js'
import { schedule } from '../drain.js'
import { TYPE_CURSOR_SIZE, writeTypeCursor } from '../cursor.js'
import { Tmp } from '../Tmp.js'
import { ModOp, PropType } from '../../../zigTsExports.js'
import { isPropDef, type SchemaPropTree } from '@based/schema'

const writeAliases = (ctx: Ctx, tree: SchemaPropTree, obj: any) => {
  for (const key in obj) {
    const def = tree[key]
    const val = obj[key]
    if (def === undefined || val === undefined) {
      continue
    }
    if (!isPropDef(def)) {
      writeAliases(ctx, def, val)
    } else if (def.typeIndex === PropType.alias) {
      const buf = ENCODER.encode(val)
      reserve(ctx, 1 + 4 + buf.byteLength)
      writeU8(ctx, def.prop)
      writeU32(ctx, buf.byteLength)
      writeU8Array(ctx, buf)
    }
  }
}

export function upsert(
  db: DbClient,
  type: string,
  payload: any,
  opts: ModifyOpts,
): Promise<number> {
  const schema = getValidSchema(db, type)
  const ctx = db.modifyCtx
  ctx.start = ctx.index
  ctx.schema = schema

  try {
    reserve(ctx, TYPE_CURSOR_SIZE + 1 + 4 + 4)
    writeTypeCursor(ctx)
    writeU8(ctx, ModOp.upsert)
    const start = ctx.index
    ctx.index += 8
    writeAliases(ctx, schema.tree, payload)
    writeUint32(ctx.buf, ctx.index - start, start)
    writeCreate(ctx, schema, {}, opts)
    writeUint32(ctx.buf, ctx.index - start, start + 4)
    writeUpdate(ctx, schema, 0, payload, opts)
    schedule(db, ctx)
    return new Tmp(ctx)
  } catch (e) {
    return handleError(db, ctx, upsert, arguments, e)
  }
}

export function insert(
  db: DbClient,
  type: string,
  payload: any,
  opts: ModifyOpts,
) {
  const schema = getValidSchema(db, type)
  const ctx = db.modifyCtx
  ctx.start = ctx.index
  ctx.schema = schema

  try {
    reserve(ctx, TYPE_CURSOR_SIZE + 1 + 4 + 4)
    writeTypeCursor(ctx)
    writeU8(ctx, ModOp.insert)
    const start = ctx.index
    ctx.index += 8
    writeAliases(ctx, schema.tree, payload)
    writeUint32(ctx.buf, ctx.index - start, start)
    writeCreate(ctx, schema, payload, opts)
    writeUint32(ctx.buf, ctx.index - start, start + 4)
    schedule(db, ctx)
    return new Tmp(ctx)
  } catch (e) {
    return handleError(db, ctx, insert, arguments, e)
  }
}
