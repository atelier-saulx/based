import { ALIAS, isPropDef, SchemaPropTree } from '@based/schema/def'
import { DbClient } from '../../../index.ts'
import { INSERT, ModifyOpts, UPSERT } from '../types.ts'
import { getValidSchema } from '../validate.ts'
import { writeU32, writeU8, writeU8Array } from '../uint.ts'
import { reserve } from '../resize.ts'
import { Ctx } from '../Ctx.ts'
import { ENCODER, writeUint32 } from '@based/utils'
import { writeCreate } from '../create/index.ts'
import { handleError } from '../error.ts'
import { writeUpdate } from '../update/index.ts'
import { schedule } from '../drain.ts'
import { TYPE_CURSOR_SIZE, writeTypeCursor } from '../cursor.ts'
import { Tmp } from '../Tmp.ts'

const writeAliases = (ctx: Ctx, tree: SchemaPropTree, obj: any) => {
  for (const key in obj) {
    const def = tree[key]
    const val = obj[key]
    if (def === undefined || val === undefined) {
      continue
    }
    if (!isPropDef(def)) {
      writeAliases(ctx, def, val)
    } else if (def.typeIndex === ALIAS) {
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
    writeU8(ctx, UPSERT)
    const start = ctx.index
    ctx.index += 8
    writeAliases(ctx, schema.tree, payload)
    writeUint32(ctx.array, ctx.index - start, start)
    writeCreate(ctx, schema, {}, opts)
    writeUint32(ctx.array, ctx.index - start, start + 4)
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
    writeU8(ctx, INSERT)
    const start = ctx.index
    ctx.index += 8
    writeAliases(ctx, schema.tree, payload)
    writeUint32(ctx.array, ctx.index - start, start)
    writeCreate(ctx, schema, payload, opts)
    writeUint32(ctx.array, ctx.index - start, start + 4)
    schedule(db, ctx)
    return new Tmp(ctx)
  } catch (e) {
    return handleError(db, ctx, insert, arguments, e)
  }
}
