import { BasedDb } from '../../index.js'
import {
  QueryDef,
  createQueryDef,
  QueryDefType,
  QueryTarget,
} from './internal.js'

export class Query {
  db: BasedDb
  def: QueryDef
  constructor(db: BasedDb, type: string, id?: number | number[]) {
    this.db = db
    const target: QueryTarget = {
      type,
    }
    if (id) {
      if (Array.isArray(id)) {
        target.ids = new Uint32Array(id)
        target.ids.sort()
      } else {
        target.id = id
      }
    }
    this.def = createQueryDef(db, QueryDefType.Root, target)
  }

  range(offset: number, limit: number): Query {
    this.def.range.offset = offset
    this.def.range.limit = limit
    return this
  }

  include(...fields: string[]) {}

  get() {
    // response
  }
}
