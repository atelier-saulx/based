import { create, update } from './set.js'
import { get } from './get.js'
import { BasedSchema, BasedSchemaPartial } from '@based/schema'
import { SchemaTypeDef, createSchemaTypeDef } from './schemaTypeDef.js'
import { deepMerge } from '@saulx/utils'
import { hashObjectIgnoreKeyOrder } from '@saulx/hash'
import { genPrefix } from './schema.js'
import dbZig from './db.js'
import { Query, query } from './query/query.js'

export * from './schemaTypeDef.js'
export * from './get.js'
export * from './set.js'
export * from './basedNode/index.js'

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

  maxModifySize: number = 100 * 1e3 * 1e3

  modifyBuffer: {
    buffer: Buffer
    len: number
    field: number
    typePrefix: Uint8Array
    id: number
    lastMain: number
  }

  native = {
    modify: (buffer: Buffer, len: number): any => {
      return dbZig.modify(buffer, len)
    },
    getQuery: (
      conditions: Buffer,
      prefix: string,
      lastId: number,
      offset: number,
      limit: number, // def 1k ?
      includeBuffer: Buffer,
      mainInclude: Buffer,
      singleRefInclude: Buffer,
    ): any => {
      return dbZig.getQuery(
        conditions,
        prefix,
        lastId,
        offset,
        limit,
        includeBuffer,
        mainInclude,
        singleRefInclude,
      )
    },
  }

  schema: BasedSchema & { prefixCounter: number } = DEFAULT_SCHEMA

  schemaTypesParsed: { [key: string]: SchemaTypeDef } = {}

  constructor({
    path,
    maxModifySize,
  }: {
    path: string
    maxModifySize?: number
  }) {
    if (maxModifySize) {
      this.maxModifySize = maxModifySize
    }
    const max = this.maxModifySize
    this.modifyBuffer = {
      buffer: Buffer.allocUnsafe(max),
      len: 0,
      field: -1,
      typePrefix: new Uint8Array([0, 0]),
      id: -1,
      lastMain: -1,
    }
    dbZig.createEnv(path)
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
        this.schemaTypesParsed[field] = createSchemaTypeDef(
          field,
          type,
          this.schemaTypesParsed,
        )
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
