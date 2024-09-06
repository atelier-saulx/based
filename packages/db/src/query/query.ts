import { BasedDb, SchemaTypeDef } from '../index.js'
import { BasedQueryResponse } from './BasedQueryResponse.js'
import { Operation, QueryIncludeDef, QueryConditions } from './types.js'
import { get } from './get.js'
import { filter } from './filter.js'
import { inspect } from 'node:util'
import { sort } from './sort.js'

export class Query {
  db: BasedDb
  schema: SchemaTypeDef
  id: number | void
  ids: number[] | void
  offset: number
  limit: number

  sortBuffer: Buffer
  sortOrder: 0 | 1

  includeDef: QueryIncludeDef

  totalConditionSize: number
  conditions: QueryConditions

  constructor(db: BasedDb, target: string, id?: number | number[]) {
    this.db = db
    let typeDef = this.db.schemaTypesParsed[target]
    this.schema = typeDef

    if (id) {
      if (Array.isArray(id)) {
        id.sort((a, b) => {
          return a > b ? 1 : b > a ? -1 : 0
        })
        this.ids = id
      } else {
        this.id = id
      }
    }
  }

  filter(field: string, operator: Operation, value: any) {
    this.totalConditionSize ??= 0
    this.conditions ??= { conditions: new Map() }
    filter(field, operator, value, this.schema, this.conditions, this)
    return this
  }

  range(offset: number, limit: number): Query {
    this.offset = offset
    this.limit = limit
    return this
  }

  include(...fields: string[]) {
    if (!this.includeDef) {
      this.includeDef = {
        includePath: [],
        schema: this.schema,
        includeArr: [],
        includeFields: new Set(),
        mainLen: 0,
        mainIncludes: {},
        includeTree: [],
      }
    }
    for (const f of fields) {
      this.includeDef.includeFields.add(f)
    }
    return this
  }

  sort(field: string, order: 'asc' | 'desc' = 'asc'): Query {
    sort(this, field, order)
    return this
  }

  get(): BasedQueryResponse {
    return get(this)
  }

  subscribe(fn: (value: any, checksum: number, err: Error) => void) {
    // TODO: add to active subs
    console.log('hello sub NOT THERE')
    // sub will all wil fire on any field
    // maybe start with this?
    // this is also where we will create diffs
    // idea use  PROXY object as a view to the buffer
  }

  [inspect.custom](_depth, { nested }) {
    return `BasedQuery[]`
  }
}

export const query = (db: BasedDb, target: string, id?: number | number[]) =>
  new Query(db, target, id)
