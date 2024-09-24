import { create, update, remove } from './modify.js'
import { Schema, SchemaType } from '@based/schema'
import {
  FieldDef,
  SchemaTypeDef,
  createSchemaTypeDef,
  schema2selva,
} from './schemaTypeDef.js'
import { deepMerge, deepCopy, wait } from '@saulx/utils'
import { hashObjectIgnoreKeyOrder } from '@saulx/hash'
import { genPrefix } from './schema.js'
import db from './native.js'
import { Query, query } from './query/query.js'
import { flushBuffer } from './operations.js'
import { destroy } from './destroy.js'

import fs from 'node:fs/promises'
import { join } from 'node:path'

export * from './schemaTypeDef.js'
export * from './modify.js'
export * from './basedNode/index.js'

type InternalSchema = Schema & {
  prefixCounter: number
  prefixToTypeMapping: Record<string, string>
  types: Record<string, SchemaType & { prefix?: string }>
}

// @ts-ignore
const DEFAULT_SCHEMA: InternalSchema = {
  // $defs: {},
  // language: 'en',
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

  schema: InternalSchema = DEFAULT_SCHEMA

  schemaTypesParsed: { [key: string]: SchemaTypeDef } = {}

  // total write time until .drain is called manualy
  writeTime: number = 0

  native = db

  fileSystemPath: string

  constructor({
    path,
    maxModifySize,
  }: {
    path: string
    maxModifySize?: number
    fresh?: boolean
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
    this.fileSystemPath = path

    this, (this.schemaTypesParsed = {})
    this.schema = deepCopy(DEFAULT_SCHEMA)
  }

  async start(opts: { clean?: boolean } = {}): Promise<
    {
      shard: number
      field: number
      entries: number
      type: number[]
      lastId: number
    }[]
  > {
    if (opts.clean) {
      try {
        await fs.rm(this.fileSystemPath, { recursive: true })
      } catch {}
    }

    try {
      await fs.mkdir(this.fileSystemPath, { recursive: true })
    } catch (err) {}
    const dumppath = join(this.fileSystemPath, 'data.sdb')

    const s = await fs.stat(dumppath).catch(() => null)

    db.start(this.fileSystemPath, s ? dumppath : null, false)

    try {
      const schema = await fs.readFile(join(this.fileSystemPath, 'schema.json'))
      if (schema) {
        //  prop need to not call setting in selva
        this.updateSchema(JSON.parse(schema.toString()), true)
      }
    } catch (err) {}

    for (const key in this.schemaTypesParsed) {
      const def = this.schemaTypesParsed[key]
      const [total, lastId] = this.native.getTypeInfo(def.prefixNumber)
      def.total = total
      def.lastId = lastId
    }

    return []
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

  updateSchema(schema: Schema, fromStart: boolean = false): Schema {
    this.schema = deepMerge(this.schema, schema)
    this.updateTypeDefs()

    if (!fromStart) {
      fs.writeFile(
        join(this.fileSystemPath, 'schema.json'),
        JSON.stringify(this.schema),
      )
      let types = Object.keys(this.schemaTypesParsed)
      const s = schema2selva(this.schemaTypesParsed)
      for (let i = 0; i < s.length; i++) {
        const type = this.schemaTypesParsed[types[i]]
        //  should not crash!
        try {
          this.native.updateSchemaType(type.prefixNumber, s[i])
        } catch (err) {
          console.error('Cannot update schema on selva', type.type, err)
        }
      }
    }

    return this.schema
  }

  removeSchema() {
    // fix
  }

  // verifyDump
  // saveDump

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
    flushBuffer(this)
    let t = this.writeTime
    this.writeTime = 0
    return t
  }

  async save() {
    const dumppath = join(this.fileSystemPath, 'data.sdb')
    await fs.rm(dumppath).catch(() => {})
    var rdy = false
    const pid = this.native.save(dumppath)
    while (!rdy) {
      await wait(100)
      if (this.native.isSaveReady(pid, dumppath)) {
        rdy = true
        break
      }
    }
  }

  async stop(noSave?: boolean) {
    if (!noSave) {
      await this.save()
    }
    db.stop()
  }

  async destroy() {
    return destroy(this)
  }
}
