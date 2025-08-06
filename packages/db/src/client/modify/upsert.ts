import { deepMerge } from '@based/utils'
import { DbClient } from '../index.js'
import { ModifyOpts } from './types.js'
import { ALIAS, isPropDef, SchemaPropTree } from '@based/schema/def'
import { QueryByAliasObj } from '../query/types.js'

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

export async function upsert(
  db: DbClient,
  type: string,
  obj: Record<string, any>,
  opts?: ModifyOpts,
) {
  const tree = db.schemaTypesParsed[type].tree
  const aliases = filterAliases(obj, tree)
  const q = db.query(type, aliases)

  q.register()

  if (db.upserting.has(q.id)) {
    const store = db.upserting.get(q.id)
    deepMerge(store.o, obj)
    return store.p
  }

  const store = {
    o: obj,
    p: q.get().then((res) => {
      db.upserting.delete(q.id)
      if (res.length === 0) {
        return db.create(type, store.o, opts)
      } else {
        const obj = res.toObject()
        const id = Array.isArray(obj) ? obj[0].id : obj.id
        // don't call update if it's not necessary
        return db.update(type, id, store.o, opts)
      }
    }),
  }

  db.upserting.set(q.id, store)
  return store.p
}
