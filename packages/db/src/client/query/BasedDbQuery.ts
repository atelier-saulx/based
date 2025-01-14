import { BasedDb } from '../../index.js'
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
  filterOr,
  convertFilter,
} from './query.js'

import { BasedQueryResponse } from './BasedIterable.js'
import { createOrGetRefQueryDef } from './include/utils.js'
import { FilterAst, FilterBranchFn } from './filter/types.js'
import { FilterBranch } from './filter/FilterBranch.js'
import { search, Search } from './search/index.js'
import {
  isValidId,
  checkMaxIdsPerQuery,
  checkTotalBufferSize,
  hasField,
  hasFields,
} from './validation.js'
import native from '../../native.js'

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

  filter(field: string, operator?: Operator | boolean, value?: any): T {
    const f = convertFilter(field, operator, value)
    filter(this.db, this.def, f, this.def.filter)
    // @ts-ignore
    return this
  }

  search(query: string, ...fields: Search[]): T {
    if (fields.length) {
      if (fields.length === 1) {
        search(this.def, query, fields[0])
      } else {
        const s = {}
        for (const f of fields) {
          if (typeof f === 'string') {
            s[f] = 0
          } else if (Array.isArray(f)) {
            for (const ff of f) {
              s[ff] = 0
            }
          } else if (typeof f === 'object') {
            Object.assign(s, f)
          }
        }
        search(this.def, query, s)
      }
    } else {
      search(this.def, query)
    }
    // @ts-ignore
    return this
  }

  filterBatch(f: FilterAst) {
    filter(this.db, this.def, f, this.def.filter)
    // @ts-ignore
    return this
  }

  or(fn: FilterBranchFn): T
  or(field: string, operator?: Operator | boolean, value?: any): T
  or(
    field: string | FilterBranchFn,
    operator?: Operator | boolean,
    value?: any,
  ): T {
    if (typeof field === 'function') {
      const f = new FilterBranch(
        this.db,
        filterOr(this.db, this.def, [], this.def.filter),
        this.def,
      )
      field(f)
      this.def.filter.size += f.filterBranch.size
    } else {
      const f = convertFilter(field, operator, value)
      filterOr(this.db, this.def, f, this.def.filter)
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
          hasFields(this.def.props)
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
        for (const field of f) {
          hasField(field)
        }
        includeFields(this.def, f)
      } else if (f !== undefined) {
        throw new Error(
          'Invalid include statement: expected props, refs and edges (string or array) or function',
        )
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
        checkMaxIdsPerQuery(id)
        target.ids = new Uint32Array(id)
        for (const id of target.ids) {
          isValidId(id)
        }
        target.ids.sort()
      } else {
        isValidId(id)
        target.id = id
      }
    }
    const def = createQueryDef(db, QueryDefType.Root, target)
    super(db, def)
  }

  async get() {
    if (!this.def.include.stringFields.size && !this.def.references.size) {
      includeFields(this.def, ['*'])
    }
    const b = defToBuffer(this.db, this.def)
    checkTotalBufferSize(b)
    const d = performance.now()
    const res = await this.db.server.getQueryBuf(Buffer.concat(b))
    if (res instanceof Error) {
      throw res
    }
    const result = Buffer.from(res)
    return new BasedQueryResponse(this.def, result, performance.now() - d)
  }

  _getSync() {
    if (!this.def.include.stringFields.size && !this.def.references.size) {
      includeFields(this.def, ['*'])
    }
    const b = defToBuffer(this.db, this.def)
    checkTotalBufferSize(b)
    const d = performance.now()
    const res = native.getQueryBuf(
      Buffer.concat(b),
      this.db.server.dbCtxExternal,
    )
    const result = Buffer.from(res)
    return new BasedQueryResponse(this.def, result, performance.now() - d)
  }

  toBuffer() {
    if (!this.def.include.stringFields.size && !this.def.references.size) {
      includeFields(this.def, ['*'])
    }
    const b = defToBuffer(this.db, this.def)
    checkTotalBufferSize(b)
    return Buffer.concat(b)
  }
}
