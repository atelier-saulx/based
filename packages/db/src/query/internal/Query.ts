import { BasedDb } from '../../index.js'
import {
  QueryDef,
  createQueryDef,
  QueryDefType,
  QueryTarget,
  includeFields,
  filter,
  Operation,
  sort,
  resultToObject,
  defToBuffer,
} from './internal.js'

// partial class
// range, include, filter, sort, traverse* later
// include will support branching (rest not yet)

export class QueryBranch {
  db: BasedDb
  def: QueryDef
  constructor(db: BasedDb, def: QueryDef) {
    this.db = db
    this.def = def
  }

  sort(field: string, order: 'asc' | 'desc' = 'asc'): QueryBranch {
    sort(this.def, field, order)
    return this
  }

  filter(field: string, operator?: Operation | boolean, value?: any) {
    if (operator === undefined) {
      operator = '='
      value = true
    } else if (typeof operator === 'boolean') {
      operator = '='
      value = operator
    }
    filter(this.db, this.def, field, operator, value)
    return this
  }

  range(offset: number, limit: number): QueryBranch {
    this.def.range.offset = offset
    this.def.range.limit = limit
    return this
  }

  include(...fields: string[]): QueryBranch {
    includeFields(this.def, fields)
    return this
  }
}

export class QueryResult {
  #result: Buffer
  #def: QueryDef
  execTime: number
  constructor(def: QueryDef, result: Buffer, execTime: number) {
    this.#def = def
    this.#result = result
    this.execTime = execTime
  }
  toObject(): any {
    return resultToObject(this.#def, this.#result)
  }
}

export class Query extends QueryBranch {
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
    return new QueryResult(this.def, result, Date.now() - d)
  }
}
