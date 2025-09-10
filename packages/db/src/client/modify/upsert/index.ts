import { ALIAS, isPropDef, SchemaPropTree } from '@based/schema/def'
import { DbClient, ENCODER, QueryByAliasObj } from '../../../index.js'
import { ModifyOpts, UPSERT } from '../types.js'
import { getValidSchema } from '../validate.js'
import { writeU32, writeU8, writeU8Array } from '../uint.js'
import { reserve } from '../resize.js'
import { Ctx } from '../Ctx.js'
import { deepMerge, writeUint32 } from '@based/utils'
import { writeCreate } from '../create/index.js'
import { handleError } from '../error.js'
import { writeUpdate } from '../update/index.js'
import { drain, schedule } from '../drain.js'
import { TYPE_CURSOR_SIZE, writeTypeCursor } from '../cursor.js'
import { Tmp } from '../Tmp.js'

const filterAliases = (obj, tree: SchemaPropTree): QueryByAliasObj => {
  let aliases: QueryByAliasObj
  for (const key in obj) {
    const def = tree[key]
    if (def === undefined) {
      return
    }
    if (isPropDef(def)) {
      if (def.typeIndex === ALIAS) {
        aliases ??= {}
        aliases[key] = obj[key]
      }
    } else {
      const nested = filterAliases(obj[key], def)
      if (nested) {
        aliases ??= {}
        aliases[key] = nested
      }
    }
  }
  return aliases
}

const promisify = (tmp: Upserting) => {
  if (!tmp.promise) {
    const id = tmp.id
    if (id) {
      tmp.promise = Promise.resolve(id)
    } else {
      tmp.promise = new Promise((resolve) => {
        const aliases = filterAliases(tmp.payload, tmp.tree)
        resolve(
          tmp.db
            .query(tmp.type, aliases)
            .get()
            .then((res) => {
              const obj = res.toObject()
              return Array.isArray(obj) ? obj[0].id : obj.id
            }),
        )
      })
    }
  }
  return tmp.promise
}

class Upserting implements Promise<number> {
  constructor(db: DbClient, type: string, payload: any, tree: SchemaPropTree) {
    this.db = db
    this.type = type
    this.payload = payload
    this.tree = tree
  }
  db: DbClient
  type: string
  payload: any
  tree: SchemaPropTree
  id: number
  promise?: Promise<number>;
  [Symbol.toStringTag]: 'UpsertPromise'
  then<Res1 = number, Res2 = never>(
    onfulfilled?: ((value: number) => Res1 | PromiseLike<Res1>) | null,
    onrejected?: ((reason: any) => Res2 | PromiseLike<Res2>) | null,
  ): Promise<Res1 | Res2> {
    return promisify(this).then(onfulfilled, onrejected)
  }

  catch<Res = never>(
    onrejected?: ((reason: any) => Res | PromiseLike<Res>) | null,
  ): Promise<number | Res> {
    return promisify(this).catch(onrejected)
  }

  finally(onfinally?: (() => void) | null): Promise<number> {
    return promisify(this).finally(onfinally)
  }
}

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
    // if (schema.id in ctx.created) {
    //   if (ctx.created[schema.id] > 0) {
    //     drain(db, ctx)
    //   }
    // } else {
    //   // TODO: reconsider this, do we want to rely on the client info or on the server lastId (latter would require more waiting)?
    //   ctx.created[schema.id] = 0
    //   ctx.max -= 6
    //   ctx.size -= 6
    // }
    reserve(ctx, TYPE_CURSOR_SIZE + 1 + 4 + 4)
    writeTypeCursor(ctx)
    writeU8(ctx, UPSERT)
    const start = ctx.index
    ctx.index += 8
    // ctx.id = 0
    writeAliases(ctx, schema.tree, payload)
    writeUint32(ctx.array, ctx.index - start, start)
    writeCreate(ctx, schema, {}, opts)
    writeUint32(ctx.array, ctx.index - start, start + 4)
    // ctx.id = 0
    writeUpdate(ctx, schema, 0, payload, opts)
    schedule(db, ctx)
    return new Tmp(ctx)
    // return new Upserting(db, type, payload, schema.tree)
  } catch (e) {
    return handleError(db, ctx, upsert, arguments, e)
  }
}
