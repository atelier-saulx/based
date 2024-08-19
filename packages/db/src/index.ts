import { create, update, remove } from './modify.js'
import { BasedSchema, BasedSchemaPartial } from '@based/schema'
import {
  FieldDef,
  SchemaTypeDef,
  createSchemaTypeDef,
} from './schemaTypeDef.js'
import { deepMerge } from '@saulx/utils'
import { hashObjectIgnoreKeyOrder } from '@saulx/hash'
import { genPrefix } from './schema.js'
import dbZig from './db.js'
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

  sortIndexes: Map<number, Set<number>> = new Map()

  // total write time until .drain is called manualy
  writeTime: number = 0

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
    ): any => {
      return dbZig.getQuery(
        conditions,
        prefix,
        lastId,
        offset,
        limit,
        includeBuffer,
      )
    },
    getQuerySort: (
      conditions: Buffer,
      prefix: string,
      lastId: number,
      offset: number,
      limit: number, // def 1k ?
      includeBuffer: Buffer,
      sort: Buffer,
      sortOrder: 0 | 1,
    ): any => {
      if (sortOrder === 1) {
        return dbZig.getQuerySortDesc(
          conditions,
          prefix,
          lastId,
          offset,
          limit,
          includeBuffer,
          sort,
        )
      } else {
        return dbZig.getQuerySortAsc(
          conditions,
          prefix,
          lastId,
          offset,
          limit,
          includeBuffer,
          sort,
        )
      }
    },
    getQueryIdsSort: (
      conditions: Buffer,
      prefix: string,
      lastId: number,
      offset: number,
      limit: number, // def 1k ?
      ids: Buffer,
      includeBuffer: Buffer,
      sort: Buffer,
      sortOrder: 0 | 1,
    ): any => {
      if (ids.length > 512 * 4) {
        if (sortOrder === 1) {
          return dbZig.getQueryIdsSortAscLarge(
            conditions,
            prefix,
            lastId,
            offset,
            limit,
            ids,
            includeBuffer,
            sort,
          )
        } else {
          return dbZig.getQueryIdsSortDescLarge(
            conditions,
            prefix,
            lastId,
            offset,
            limit,
            ids,
            includeBuffer,
            sort,
          )
        }
      }
      if (sortOrder === 1) {
        return dbZig.getQueryIdsSortAsc(
          conditions,
          prefix,
          lastId,
          offset,
          limit,
          ids,
          includeBuffer,
          sort,
        )
      } else {
        return dbZig.getQueryIdsSortDesc(
          conditions,
          prefix,
          lastId,
          offset,
          limit,
          ids,
          includeBuffer,
          sort,
        )
      }
    },
    getQueryById: (
      conditions: Buffer,
      prefix: string,
      id: number,
      includeBuffer: Buffer,
    ): any => {
      return dbZig.getQueryById(conditions, prefix, id, includeBuffer)
    },
    getQueryByIds: (
      conditions: Buffer,
      prefix: string,
      ids: Buffer,
      includeBuffer: Buffer,
    ): any => {
      return dbZig.getQueryByIds(conditions, prefix, ids, includeBuffer)
    },
  }

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
      mergeMainSize: 0,
      mergeMain: null,
      buffer: Buffer.allocUnsafe(max),
      len: 0,
      field: -1,
      typePrefix: new Uint8Array([0, 0]),
      id: -1,
      lastMain: -1,
    }
    dbZig.createEnv(path)
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
    dbZig.stat()
  }

  tester() {
    const d = Date.now()
    dbZig.tester()
    console.log('Tester took', Date.now() - d, 'ms')
  }
}
