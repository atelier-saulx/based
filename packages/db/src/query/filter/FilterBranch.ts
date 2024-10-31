import { BasedDb } from '../../index.js'
import { QueryDefFilter, QueryDef } from '../types.js'
import { convertFilter, filter, filterOr } from './filter.js'
import { Operator } from './operators.js'
import { FilterBranchFn } from './types.js'

export class FilterBranch {
  constructor(db: BasedDb, filterBranch: QueryDefFilter, def: QueryDef) {
    this.def = def
    this.filterBranch = filterBranch
    this.db = db
  }

  db: BasedDb
  filterBranch: QueryDefFilter
  def: QueryDef

  or(fn: FilterBranchFn): FilterBranch
  or(field: string, operator?: Operator | boolean, value?: any): FilterBranch
  or(
    field: string | FilterBranchFn,
    operator?: Operator | boolean,
    value?: any,
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
      const f = convertFilter(field, operator, value)
      filterOr(this.db, this.def, f, this.filterBranch)
    }
    return this
  }

  filter(field: string, operator?: Operator | boolean, value?: any) {
    const f = convertFilter(field, operator, value)
    for (const seg of f) {
      filter(this.db, this.def, seg, this.filterBranch)
    }
    return this
  }
}
