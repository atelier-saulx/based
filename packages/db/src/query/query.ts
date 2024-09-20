import { BasedDb, SchemaTypeDef } from '../index.js'
import { BasedQueryResponse } from './BasedQueryResponse.js'
import { Operation, QueryIncludeDef, QueryConditions } from './types.js'
import { get } from './get.js'
import { addConditions, filter } from './filter.js'
import { inspect } from 'node:util'
import { sort } from './sort.js'
import { BranchInclude, Select } from './branch.js'

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

  include(...fields: (string | BranchInclude | undefined)[]) {
    if (!this.includeDef) {
      this.includeDef = {
        includePath: [],
        schema: this.schema,
        includeArr: [],
        includeFields: new Set(),
        mainLen: 0,
        mainIncludes: {},
        includeTree: [],
        multiple: false,
        referencesFilters: {},
      }
    }

    for (const f of fields) {
      if (typeof f === 'string') {
        this.includeDef.includeFields.add(f)
      } else if (typeof f === 'function') {
        // ------------------------------- fix that it becomes recursive..
        var selects = []
        const select = (field: string) => {
          const s = new Select(field, this)
          selects.push(s)
          return s
        }
        f(select)
        for (const s of selects) {
          const fieldDef = this.includeDef.schema.fields[s.field]

          const fSchema = this.db.schemaTypesParsed[fieldDef.allowedType]

          if (s.filters.length) {
            if (fieldDef.type === 'references') {
              // add conditions there
              if (!this.includeDef.referencesFilters[s.field]) {
                this.includeDef.referencesFilters[s.field] = {
                  conditions: new Map(),
                  size: 0,
                }
              }
              const conditions = this.includeDef.referencesFilters[s.field]
              var size = conditions.size

              this.totalConditionSize ??= 0
              const startSize = this.totalConditionSize

              for (const f of s.filters) {
                filter(f.field, f.operator, f.value, fSchema, conditions, this)
              }

              const d = this.totalConditionSize - startSize

              conditions.size += d

              console.log('-->', conditions.size)

              this.totalConditionSize = startSize
            } else {
              console.error('Cannot filter other fields then references..')
            }
          }
          if (s.includes.length) {
            for (const include of s.includes) {
              this.includeDef.includeFields.add(s.field + '.' + include)
            }
          }
        }
        // -------------------------------
      }
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
