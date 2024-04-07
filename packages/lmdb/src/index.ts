import { createBuffer } from './set.js'
import { parseBuffer } from './get.js'
import { BasedSchema, BasedSchemaPartial } from '@based/schema'
import { SchemaTypeDef, createSchemaTypeDef } from './createSchemaTypeDef.js'
import { inflateSync, deflateSync } from 'node:zlib'
import { deepMerge } from '@saulx/utils'
import { hashObjectIgnoreKeyOrder } from '@saulx/hash'
import { genPrefix } from './schema.js'

export * from './createSchemaTypeDef.js'
export * from './get.js'
export * from './set.js'

const DEFAULT_SCHEMA: BasedSchema & { prefixCounter: number } = {
  $defs: {},
  language: 'en',
  prefixToTypeMapping: {},
  types: {},
  prefixCounter: 0,
}

export class BasedDb {
  writes: [string, any, Buffer][] = []

  writeListeners: ((x?: any) => void)[] = []

  isDraining: boolean = false

  schema: BasedSchema & { prefixCounter: number } = DEFAULT_SCHEMA
  schemaTypesParsed: { [key: string]: SchemaTypeDef } = {}

  constructor({
    path,
    memSize = 100 * 1024 * 1024 * 1024,
  }: {
    path: string
    memSize?: number
  }) {
    // const schema = txn.getBinaryUnsafe(this.dbis.config, 'schema')
    // if (schema) {
    //   this.schema = JSON.parse(inflateSync(schema).toString())
    //   this.updateTypeDefs()
    // }
    // txn.commit()
  }

  updateTypeDefs() {
    for (const field in this.schema.types) {
      const type = this.schema.types[field]
      if (
        this.schemaTypesParsed[field] &&
        this.schemaTypesParsed[field]._checksum ===
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
    // const txn = this.env.beginTxn()
    // txn.putBinary(
    //   this.dbis.config,
    //   'schema',
    //   deflateSync(JSON.stringify(this.schema)),
    // )
    // txn.commit()
    return this.schema
  }

  set(value: any[] | any) {
    // return set(this, value)
  }

  get(key: string) {}
}
