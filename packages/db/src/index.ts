import { create, update, remove } from './modify.js'
import { BasedSchema, BasedSchemaPartial } from '@based/schema'
import {
  FieldDef,
  SchemaTypeDef,
  createSchemaTypeDef,
} from './schemaTypeDef.js'
import { deepMerge, deepCopy } from '@saulx/utils'
import { hashObjectIgnoreKeyOrder } from '@saulx/hash'
import { genPrefix } from './schema.js'
import db from './native.js'
import { Query, query } from './query/query.js'
import { flushBuffer } from './operations.js'

export * from './schemaTypeDef.js'
export * from './modify.js'
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
    hasStringField: number
    buffer: Buffer
    len: number
    field: number
    typePrefix: Uint8Array
    id: number
    lastMain: number
    mergeMain: (FieldDef | any)[] | null
    mergeMainSize: number
  }

  schema: BasedSchema & { prefixCounter: number } = DEFAULT_SCHEMA

  schemaTypesParsed: { [key: string]: SchemaTypeDef } = {}

  // total write time until .drain is called manualy
  writeTime: number = 0

  native = db

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
      hasStringField: -1,
      mergeMainSize: 0,
      mergeMain: null,
      buffer: Buffer.allocUnsafe(max),
      len: 0,
      field: -1,
      typePrefix: new Uint8Array([0, 0]),
      id: -1,
      lastMain: -1,
    }
    this, (this.schemaTypesParsed = {})
    this.schema = deepCopy(DEFAULT_SCHEMA)
    db.start(path)
  }

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
        const def = createSchemaTypeDef(field, type, this.schemaTypesParsed)
        this.schemaTypesParsed[field] = def
      }
    }
  }

  updateSchema(schema: BasedSchemaPartial): BasedSchema {
    this.schema = deepMerge(this.schema, schema)
    this.updateTypeDefs()
    return this.schema
  }

  removeSchema() {
    // fix
  }

  create(type: string, value: any) {
    return create(this, type, value)
  }

  update(type: string, id: number, value: any, overwrite?: boolean) {
    return update(this, type, id, value, overwrite)
  }

  remove(type: string, id: number) {
    return remove(this, type, id)
  }

  query(target: string, id?: number | number[]): Query {
    return query(this, target, id)
  }

  // drain write buffer returns perf in ms
  drain() {
    return flushBuffer(this)
  }

  stats() {
    db.stat()
  }

  tester() {
    const d = Date.now()
    db.tester()
    console.log('Tester took', Date.now() - d, 'ms')
  }

  stop() {
    db.stop()
  }
}
