import { create, update } from './set.js'
import { get } from './get.js'
import { BasedSchema, BasedSchemaPartial } from '@based/schema'
import { SchemaTypeDef, createSchemaTypeDef } from './createSchemaTypeDef.js'
import { deepMerge } from '@saulx/utils'
import { hashObjectIgnoreKeyOrder } from '@saulx/hash'
import { genPrefix } from './schema.js'
import dbZig from './db.js'
import { Query, query } from './query.js'

export * from './createSchemaTypeDef.js'
export * from './get.js'
export * from './set.js'

// @ts-ignore
const DEFAULT_SCHEMA: BasedSchema & { prefixCounter: number } = {
  $defs: {},
  language: 'en',
  prefixToTypeMapping: {},
  types: {},
  prefixCounter: 0,
}

export class BasedDb {
  isDraining: boolean = false

  native = {
    modify: (buffer: Buffer, len: number): any => {
      return dbZig.modify(buffer, len)
    },
    getQuery: (
      conditions: Buffer,
      prefix: string,
      lastId: number,
      offset: number,
      limit: number // def 1k ?
    ): any => {
      return dbZig.getQuery(conditions, prefix, lastId, offset, limit)
    },
  }

  schema: BasedSchema & { prefixCounter: number } = DEFAULT_SCHEMA
  schemaTypesParsed: { [key: string]: SchemaTypeDef } = {}

  constructor({ path }: { path: string; writeBufferSize?: number }) {
    dbZig.createEnv(path)
    // writeBufferSize
  }

  // queryID thing with conditions etc

  updateTypeDefs() {
    for (const field in this.schema.types) {
      const type = this.schema.types[field]
      if (
        this.schemaTypesParsed[field] &&
        this.schemaTypesParsed[field].checksum ===
          hashObjectIgnoreKeyOrder(type)
      ) {
        continue
      } else {
        if (!type.prefix || !this.schema.prefixToTypeMapping[type.prefix]) {
          if (!type.prefix) {
            type.prefix = genPrefix(this)
          }
          this.schema.prefixToTypeMapping[type.prefix] = field
        }
        this.schemaTypesParsed[field] = createSchemaTypeDef(type)
      }
    }
  }

  updateSchema(schema: BasedSchemaPartial): BasedSchema {
    this.schema = deepMerge(this.schema, schema)
    this.updateTypeDefs()
    return this.schema
  }

  create(type: string, value: any) {
    return create(this, type, value)
  }

  update(type: string, id: number, value: any, merge?: boolean) {
    return update(this, type, id, value, merge)
  }

  // REMOVE FAST
  remove(type: string, id: number) {
    // goes into the same buffer as modify make a modify command for this
  }

  get(type: string, id: number, include?: string[], exclude?: string[]) {
    // get all except ref if no include
    return get(this, type, id, include)
  }

  query(target: string): Query {
    return query(this, target)
  }
}
