import { ALIAS } from '@based/schema/def'
import { DbClient } from '../index.js'
import { BasedDbQuery } from '../query/BasedDbQuery.js'
import { ModifyOpts } from './types.js'

export async function upsert(
  db: DbClient,
  type: string,
  obj: Record<string, any>,
  opts?: ModifyOpts,
) {
  const tree = db.schemaTypesParsed[type].tree
  let q: BasedDbQuery
  let id = type

  for (const key in obj) {
    if (tree[key].typeIndex === ALIAS) {
      id += `${key}:${obj[key]};`
      if (q) {
        q = q.or(key, '=', obj[key])
      } else {
        q = db.query(type).include('id').filter(key, '=', obj[key])
      }
    }
  }

  if (!q) {
    // fix with promise
    throw new Error('no alias found for upsert operation')
  }

  if (db.upserting.has(id)) {
    const store = db.upserting.get(id)
    store.o = { ...store.o, ...obj }
    return store.p
  }

  const store = {
    o: obj,
    p: q.get().then((res) => {
      db.upserting.delete(id)
      if (res.length === 0) {
        return db.create(type, store.o, opts)
      } else {
        return db.update(type, res.toObject()[0].id, store.o, opts)
      }
    }),
  }

  db.upserting.set(id, store)
  return store.p
}
