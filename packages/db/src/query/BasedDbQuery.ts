import { BasedDb } from '../index.js'
import {
  QueryDef,
  createQueryDef,
  QueryDefType,
  QueryTarget,
  includeFields,
  filter,
  Operator,
  sort,
  defToBuffer,
  getAll,
} from './query.js'

import { BasedQueryResponse } from './BasedIterable.js'
import { createOrGetRefQueryDef } from './include/utils.js'

// partial class
// range, include, filter, sort, traverse* later
// include will support branching (rest not yet)

// fix nested type...
export type SelectFn = (field: string) => BasedDbReferenceQuery

export type BranchInclude = (select: SelectFn) => any

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

  // .or() - () => {}

  filter(field: string, operator?: Operator | boolean, value?: any): T {
    if (operator === undefined) {
      operator = '='
      value = true
    } else if (typeof operator === 'boolean') {
      value = operator
      operator = '='
    }

    if (operator == '!..') {
      if (!Array.isArray(value)) {
        throw new Error('Invalid filter')
      }
      filter(this.db, this.def, field, '>', value[1])
      // OR
      // filter(this.db, this.def, field, '<', value[0])
    } else if (operator === '..') {
      if (!Array.isArray(value)) {
        throw new Error('Invalid filter')
      }
      filter(this.db, this.def, field, '>', value[0])
      filter(this.db, this.def, field, '<', value[1])
    } else {
      filter(this.db, this.def, field, operator, value)
    }
    // @ts-ignore
    return this
  }

  range(offset: number, limit: number): T {
    this.def.range.offset = offset
    this.def.range.limit = limit
    // @ts-ignore
    return this
  }

  include(...fields: (string | BranchInclude | string[])[]): T {
    for (const f of fields) {
      if (typeof f === 'string') {
        if (f === '*') {
          includeFields(this.def, getAll(this.def.props))
        } else {
          this.def.include.stringFields.add(f)
        }
      } else if (typeof f === 'function') {
        f((field: string) => {
          const prop = this.def.props[field]
          if (prop && (prop.typeIndex === 13 || prop.typeIndex === 14)) {
            const refDef = createOrGetRefQueryDef(this.db, this.def, prop)
            // @ts-ignore
            return new QueryBranch(this.db, refDef)
          }
          throw new Error(`No ref field named ${field}`)
        })
      } else if (Array.isArray(f)) {
        includeFields(this.def, f)
      } else if (f !== undefined) {
        throw new Error('Invalid include statement')
      }
    }

    // @ts-ignore
    return this
  }
}

export class BasedDbReferenceQuery extends QueryBranch<BasedDbReferenceQuery> {}

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

  get() {
    if (!this.def.include.stringFields.size && !this.def.references.size) {
      includeFields(this.def, ['*'])
    }
    const b = defToBuffer(this.db, this.def)
    const d = performance.now()
    const result = this.db.native.getQueryBuf(
      Buffer.concat(b),
      this.db.dbCtxExternal,
    )
    return new BasedQueryResponse(this.def, result, performance.now() - d)
  }

  toBuffer() {
    if (!this.def.include.stringFields.size && !this.def.references.size) {
      includeFields(this.def, ['*'])
    }
    const b = defToBuffer(this.db, this.def)
    return Buffer.concat(b)
  }
}
