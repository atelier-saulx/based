import { TYPE_CURSOR_SIZE, writeTypeCursor } from '../cursor.js'
import { writeU32, writeU8, writeU8Array } from '../uint.js'
import { INSERT, ModifyOpts, UPSERT } from '../types.js'
import { ENCODER, writeUint32 } from '@based/utils'
import { writeCreate } from '../create/index.js'
import { writeUpdate } from '../update/index.js'
import { getValidSchema } from '../validate.js'
import { DbClient } from '../../../index.js'
import { handleError } from '../error.js'
import { reserve } from '../resize.js'
import { schedule } from '../drain.js'
import { Ctx } from '../Ctx.js'
import { Tmp } from '../Tmp.js'

import type { BranchDef } from '@based/schema'

const writeAliases = (ctx: Ctx, tree: BranchDef, obj: any) => {
  for (const key in obj) {
    const def = tree.props[key]
    const val = obj[key]
    if (def === undefined || val === undefined) {
      continue
    }
    if ('props' in def) {
      writeAliases(ctx, def, val)
    } else if (def.type === 'alias') {
      const buf = ENCODER.encode(val)
      reserve(ctx, 1 + 4 + buf.byteLength)
      writeU8(ctx, def.id)
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
  const typeDef = getValidSchema(db, type)
  const ctx = db.modifyCtx
  ctx.start = ctx.index
  ctx.typeDef = typeDef

  try {
    reserve(ctx, TYPE_CURSOR_SIZE + 1 + 4 + 4)
    writeTypeCursor(ctx)
    writeU8(ctx, UPSERT)
    const start = ctx.index
    ctx.index += 8
    writeAliases(ctx, typeDef, payload)
    writeUint32(ctx.array, ctx.index - start, start)
    writeCreate(ctx, typeDef, {}, opts)
    writeUint32(ctx.array, ctx.index - start, start + 4)
    writeUpdate(ctx, typeDef, 0, payload, opts)
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
  const typeDef = getValidSchema(db, type)
  const ctx = db.modifyCtx
  ctx.start = ctx.index
  ctx.typeDef = typeDef

  try {
    reserve(ctx, TYPE_CURSOR_SIZE + 1 + 4 + 4)
    writeTypeCursor(ctx)
    writeU8(ctx, INSERT)
    const start = ctx.index
    ctx.index += 8
    writeAliases(ctx, typeDef, payload)
    writeUint32(ctx.array, ctx.index - start, start)
    writeCreate(ctx, typeDef, payload, opts)
    writeUint32(ctx.array, ctx.index - start, start + 4)
    schedule(db, ctx)
    return new Tmp(ctx)
  } catch (e) {
    return handleError(db, ctx, insert, arguments, e)
  }
}
