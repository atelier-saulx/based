import { Query } from './query.js'
import { Operation } from './types.js'

export class Select {
  field: string
  query: Query
  includes: (string | undefined)[]
  filters: {
    field: string
    operator: Operation
    value: any
  }[]

  constructor(field: string, query: Query) {
    this.field = field
    this.query = query
    this.includes = []
    this.filters = []
  }

  include(...fields: (string | undefined)[]): Select {
    this.includes.push(...fields)
    return this
  }

  filter(field: string, operator: Operation, value: any): Select {
    this.filters.push({
      field,
      operator,
      value,
    })
    return this
  }
}

export type SelectFn = (field: string) => Select

export type BranchInclude = (select: SelectFn) => any
