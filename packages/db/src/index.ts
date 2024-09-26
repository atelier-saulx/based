import { create, update, remove } from './modify/modify.js'
import { ModifyRes } from './modify/ModifyRes.js'
import { Schema, SchemaType } from '@based/schema'
import {
  PropDef,
  SchemaTypeDef,
  createSchemaTypeDef,
  schemaToSelvaBuffer,
} from './schema/schema.js'
import { deepMerge, deepCopy, wait } from '@saulx/utils'
import { hashObjectIgnoreKeyOrder } from '@saulx/hash'
import db from './native.js'
import { Query, query } from './query/query.js'
import { flushBuffer } from './operations.js'
import { destroy } from './destroy.js'

import fs from 'node:fs/promises'
import { join } from 'node:path'
import { genId } from './schema/utils.js'

export * from './schema/typeDef.js'
export * from './modify/modify.js'
export * from './basedNode/index.js'

type InternalSchema = Schema & {
  lastId: number
  types: Record<string, SchemaType>
}

const DEFAULT_SCHEMA: InternalSchema = {
  types: {},
  lastId: 0,
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
    mergeMain: (PropDef | any)[] | null
    mergeMainSize: number
    queue: any[]
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
      queue: [],
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
      const [total, lastId] = this.native.getTypeInfo(def.id)
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
          hashObjectIgnoreKeyOrder(type) // bit weird..
      ) {
        continue
      } else {
        if (!type.id) {
          type.id = genId(this)
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
      const s = schemaToSelvaBuffer(this.schemaTypesParsed)
      for (let i = 0; i < s.length; i++) {
        //  TYPE SELVA user Uint8Array(6) [ 1, 17, 23, 0, 11, 0 ]
        const type = this.schemaTypesParsed[types[i]]
        // TODO should not crash!
        try {
          this.native.updateSchemaType(type.id, s[i])
        } catch (err) {
          console.error('Cannot update schema on selva', type.type, err)
        }
      }
    }
    return this.schema
  }

  removeSchema() {
    // TODO fix
  }

  create(type: string, value: any): ModifyRes {
    return create(this, type, value)
  }

  update(
    type: string,
    id: number | ModifyRes,
    value: any,
    overwrite?: boolean,
  ): ModifyRes {
    return update(
      this,
      type,
      typeof id === 'number' ? id : id.tmpId,
      value,
      overwrite,
    )
  }

  remove(type: string, id: number | ModifyRes) {
    return remove(this, type, typeof id === 'number' ? id : id.tmpId)
  }

  query(
    target: string,
    id?: number | ModifyRes | (number | ModifyRes)[],
  ): Query {
    if (Array.isArray(id)) {
      let i = id.length
      while (i--) {
        if (typeof id[i] == 'object') {
          // @ts-ignore
          id[i] = id[i].tmpId
        }
      }
    } else if (typeof id == 'object') {
      // @ts-ignore
      id = id.tmpId
    }

    // @ts-ignore
    return query(this, target, id)
  }

  // drain write buffer returns perf in ms
  drain() {
    flushBuffer(this)
    const t = this.writeTime
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
