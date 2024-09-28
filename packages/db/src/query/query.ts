import { BasedDb } from '../index.js'
import { SchemaTypeDef } from '../schema/schema.js'
import { BasedQueryResponse } from './BasedQueryResponse.js'
import { Operation, QueryIncludeDef, QueryConditions } from './types.js'
import { get } from './get.js'
import { filter } from './filter.js'
import { inspect } from 'node:util'
import { sort } from './sort.js'
import { BranchInclude, Select } from './branch.js'
import { buffer } from 'stream/consumers'
import { toBuffer } from './buffer.js'

export class Query {
  db: BasedDb
  schema: SchemaTypeDef
  id: number | void
  ids: number[] | void
  offset: number
  limit: number

  includeBuffer: Buffer
  filterTime: Buffer

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

  filter(field: string, operator?: Operation | boolean, value?: any) {
    this.totalConditionSize ??= 0
    this.conditions ??= { conditions: new Map() }

    if (operator === undefined) {
      operator = '='
      value = true
    } else if (typeof operator === 'boolean') {
      operator = '='
      value = operator
    }

    this.totalConditionSize += filter(
      field,
      operator,
      value,
      this.schema,
      this.conditions,
      this,
    )
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
        props: this.schema.props,
        includeArr: [],
        includeFields: new Set(),
        mainLen: 0,
        mainIncludes: {},
        includeTree: [],
        multiple: false,
        referencesFilters: {},
        referencesSortOptions: {},
      }
    }

    for (const f of fields) {
      if (typeof f === 'string') {
        if (f === '*') {
          for (const f in this.schema.props) {
            if (
              this.schema.props[f].typeIndex !== 13 &&
              this.schema.props[f].typeIndex !== 14
            ) {
              this.include(f)
            }
          }
        } else {
          this.includeDef.includeFields.add(f)
        }
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
          const fieldDef = this.includeDef.schema.props[s.field]
          const fSchema = this.db.schemaTypesParsed[fieldDef.inverseTypeName]

          if (s.filters.length || s.sortOpts) {
            // 14: references
            if (fieldDef.typeIndex === 14) {
              if (!this.includeDef.referencesFilters[s.field]) {
                this.includeDef.referencesFilters[s.field] = {
                  conditions: new Map(),
                  size: 0,
                }
              }
              const conditions = this.includeDef.referencesFilters[s.field]
              if (s.sortOpts) {
                this.includeDef.referencesSortOptions[s.field] = s.sortOpts
              }
              for (const f of s.filters) {
                conditions.size += filter(
                  f.field,
                  f.operator,
                  f.value,
                  fSchema,
                  conditions,
                  this,
                )
              }
            } else {
              console.error('Cannot filter other fields then references..')
            }
          }
          if (s.includes.length) {
            for (const include of s.includes) {
              this.includeDef.includeFields.add(s.field + '.' + include)
            }
          } else if (fieldDef.typeIndex === 14 || fieldDef.typeIndex === 13) {
            const schema = this.db.schemaTypesParsed[fieldDef.inverseTypeName]
            for (const nestedProp in schema.props) {
              if (
                schema.props[nestedProp].typeIndex !== 13 &&
                schema.props[nestedProp].typeIndex !== 14
              ) {
                this.includeDef.includeFields.add(s.field + '.' + nestedProp)
              }
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

  toBuffer() {
    return toBuffer(this)
  }
}

export const query = (db: BasedDb, target: string, id?: number | number[]) =>
  new Query(db, target, id)
