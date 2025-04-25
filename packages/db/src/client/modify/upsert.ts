import { deepMerge } from '@saulx/utils'
import { DbClient } from '../index.js'
import { ModifyOpts } from './types.js'

export async function upsert(
  db: DbClient,
  type: string,
  obj: Record<string, any>,
  opts?: ModifyOpts,
) {
  const q = db.query(type, obj)

  // this adds the id
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
        return db.update(type, res.toObject().id, store.o, opts)
      }
    }),
  }

  db.upserting.set(q.id, store)
  return store.p
}
