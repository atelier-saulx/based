import { ALIAS, isPropDef, SchemaPropTree } from '@based/schema/def'
import { DbClient, ENCODER, QueryByAliasObj } from '../../../index.js'
import { ModifyOpts, UPSERT } from '../types.js'
import { getValidSchema } from '../validate.js'
import { writeU32, writeU8, writeU8Array } from '../uint.js'
import { reserve } from '../resize.js'
import { Ctx } from '../Ctx.js'
import { writeUint32 } from '@based/utils'
import { writeCreate } from '../create/index.js'
import { handleError } from '../error.js'
import { writeUpdate } from '../update/index.js'
import { schedule } from '../drain.js'
import { TYPE_CURSOR_SIZE, writeTypeCursor } from '../cursor.js'

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
      console.log(def.prop, obj, buf, val, buf.byteLength)
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
    console.log('-->', payload)
    reserve(ctx, TYPE_CURSOR_SIZE + 1 + 4 + 4)
    writeTypeCursor(ctx)
    writeU8(ctx, UPSERT)
    const start = ctx.index
    ctx.index += 8
    ctx.id = 0
    writeAliases(ctx, schema.tree, payload)
    console.log('write:', ctx.index)
    writeUint32(ctx.array, ctx.index - start, start)
    writeCreate(ctx, schema, {}, opts)
    console.log('update:', ctx.index)
    writeUint32(ctx.array, ctx.index - start, start + 4)
    ctx.id = 0
    writeUpdate(ctx, schema, payload, opts)
    schedule(db, ctx)
    // return {
    //   then() {
    //     const aliases = filterAliases(payload, schema.tree)
    //     const q = db.query(type, aliases)
    //   },
    // }
  } catch (e) {
    return handleError(db, ctx, upsert, arguments, e)
  }

  // try {
  //   // writeTypeCursor(ctx)
  //   // upsert mode
  //   // do a create (if not exist)
  //   //
  // } catch (e) {}

  // db.create(type, obj, opts)

  // const tree = db.schemaTypesParsed[type].tree
  // const aliases = filterAliases(obj, tree)
  // const q = db.query(type, aliases)

  // q.register()

  // if (db.upserting.has(q.id)) {
  //   const store = db.upserting.get(q.id)
  //   deepMerge(store.o, obj)
  //   return store.p
  // }

  // const store = {
  //   o: obj,
  //   p: q.get().then((res) => {
  //     db.upserting.delete(q.id)
  //     if (res.length === 0) {
  //       return db.create(type, store.o, opts)
  //     } else {
  //       const obj = res.toObject()
  //       const id = Array.isArray(obj) ? obj[0].id : obj.id
  //       // don't call update if it's not necessary
  //       return db.update(type, id, store.o, opts)
  //     }
  //   }),
  // }

  // db.upserting.set(q.id, store)
  // return store.p
}
