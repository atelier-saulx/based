import { BasedDb } from '../index.js'
import {
  QueryDef,
  createQueryDef,
  QueryDefType,
  QueryTarget,
  includeFields,
  filter,
  Operation,
  sort,
  defToBuffer,
} from './query.js'

import { BasedIterable } from './BasedIterable.js'

// partial class
// range, include, filter, sort, traverse* later
// include will support branching (rest not yet)

export class QueryBranch<T> {
  db: BasedDb
  def: QueryDef

  constructor(db: BasedDb, def: QueryDef) {
    this.db = db
    this.def = def
  }

  sort(field: string, order: 'asc' | 'desc' = 'asc'): T {
    sort(this.def, field, order)
    // @ts-ignore
    return this
  }

  filter(field: string, operator?: Operation | boolean, value?: any): T {
    if (operator === undefined) {
      operator = '='
      value = true
    } else if (typeof operator === 'boolean') {
      operator = '='
      value = operator
    }
    filter(this.db, this.def, field, operator, value)
    // @ts-ignore
    return this
  }

  range(offset: number, limit: number): T {
    this.def.range.offset = offset
    this.def.range.limit = limit
    // @ts-ignore
    return this
  }

  include(...fields: (string | any)[]): T {
    includeFields(this.def, fields)
    // @ts-ignore
    return this
  }
}

export class BasedDbQuery extends QueryBranch<BasedDbQuery> {
  constructor(db: BasedDb, type: string, id?: number | number[]) {
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
    const def = createQueryDef(db, QueryDefType.Root, target)
    super(db, def)
  }

  // this can be a partyial class

  get() {
    const b = defToBuffer(this.db, this.def)
    const d = Date.now()
    const result = this.db.native.getQueryBuf(Buffer.concat(b))
    return new BasedIterable(this.def, result, Date.now() - d)
  }
}
