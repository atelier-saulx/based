import { DbClient } from '../../index.js'
import { QueryDefFilter, QueryDef } from '../types.js'
import { filter, filterOr } from './filter.js'
import { convertFilter } from './convertFilter.js'
import { FilterOpts, Operator } from './types.js'
import { FilterBranchFn } from './types.js'

export class FilterBranch {
  constructor(db: DbClient, filterBranch: QueryDefFilter, def: QueryDef) {
    this.def = def
    this.filterBranch = filterBranch
    this.db = db
  }

  db: DbClient
  filterBranch: QueryDefFilter
  def: QueryDef

  or(fn: FilterBranchFn): FilterBranch
  or(
    field: string,
    operator?: Operator | boolean,
    value?: any,
    opts?: FilterOpts,
  ): FilterBranch
  or(
    field: string | FilterBranchFn,
    operator?: Operator | boolean,
    value?: any,
    opts?: FilterOpts,
  ): FilterBranch {
    if (typeof field === 'function') {
      const f = new FilterBranch(
        this.db,
        filterOr(this.db, this.def, [], this.filterBranch),
        this.def,
      )
      field(f)
      this.def.filter.size += f.filterBranch.size
    } else {
      const f = convertFilter(this, field, operator, value, opts)
      if (f) {
        filterOr(this.db, this.def, f, this.filterBranch)
      }
    }
    return this
  }

  filter(field: string, operator?: Operator | boolean, value?: any) {
    const f = convertFilter(this, field, operator, value)
    if (f) {
      filter(this.db, this.def, f, this.filterBranch)
    }
    return this
  }
}
