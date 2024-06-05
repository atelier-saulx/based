import { BasedDb, SchemaTypeDef } from '../index.js'
import { BasedQueryResponse } from './BasedQueryResponse.js'
import { Operation } from './types.js'
import { get } from './get.js'
import { filter } from './filter.js'

export class Query {
  db: BasedDb
  type: SchemaTypeDef
  id: number | void
  conditions: Map<number, Buffer[]>
  offset: number
  limit: number
  includeFields: string[]
  mainIncludes: Map<number, number>
  totalConditionSize: number = 0
  constructor(db: BasedDb, target: string, previous?: Query) {
    this.db = db
    let typeDef = this.db.schemaTypesParsed[target]
    if (typeDef) {
      this.type = typeDef
    } else {
      // is ID check prefix
    }
  }

  filter(field: string, operator: Operation, value: any) {
    return filter(this, field, operator, value)
  }

  range(offset: number, limit: number): Query {
    this.offset = offset
    this.limit = limit
    return this
  }

  include(...fields: string[]) {
    this.includeFields = this.includeFields
      ? [...this.includeFields, ...fields]
      : fields
    return this
  }

  get(): BasedQueryResponse {
    return get(this)
  }

  subscribe(fn: (value: any, checksum: number, err: Error) => void) {
    console.log('hello sub')
    // sub will all wil fire on any field
    // maybe start with this?
    // this is also where we will create diffs
    // idea use  PROXY object as a view to the buffer
  }
}

export const query = (db: BasedDb, target: string) => new Query(db, target)
