import { create, update, remove } from './modify/modify.js'
import { ModifyRes } from './modify/ModifyRes.js'
import { parse, Schema } from '@based/schema'
import {
  PropDef,
  SchemaTypeDef,
  createSchemaTypeDef,
  schemaToSelvaBuffer,
} from './schema/schema.js'
import { wait } from '@saulx/utils'
import { hashObjectIgnoreKeyOrder, hash, stringHash } from '@saulx/hash'
import db from './native.js'
import { BasedDbQuery } from './query/BasedDbQuery.js'
import { flushBuffer } from './operations.js'
import { destroy } from './destroy.js'
import { setTimeout } from 'node:timers/promises'
import fs from 'node:fs/promises'
import { join } from 'node:path'
import { genId } from './schema/utils.js'

export * from './schema/typeDef.js'
export * from './modify/modify.js'

const SCHEMA_FILE = 'schema.json'

export class BasedDb {
  isDraining: boolean = false
  maxModifySize: number = 100 * 1e3 * 1e3
  modifyCtx: {
    max: number
    buf: Buffer
    hasStringField: number
    len: number
    field: number
    prefix0: number
    prefix1: number
    id: number
    lastMain: number
    mergeMain: (PropDef | any)[] | null
    mergeMainSize: number
    ctx: { offset?: number }
    queue: Map<number, (id: number) => void>
    db: BasedDb
  }

  id: number

  dbCtxExternal: any

  schema: Schema & { lastId: number }

  schemaTypesParsed: { [key: string]: SchemaTypeDef } = {}

  // total write time until .drain is called manualy
  writeTime: number = 0

  native = db

  fileSystemPath: string
  splitDump: boolean

  constructor({
    path,
    splitDump,
    maxModifySize,
  }: {
    path: string
    splitDump?: boolean
    maxModifySize?: number
    fresh?: boolean
  }) {
    if (maxModifySize) {
      this.maxModifySize = maxModifySize
    }
    const max = this.maxModifySize
    this.modifyCtx = {
      max,
      hasStringField: -1,
      mergeMainSize: 0,
      mergeMain: null,
      buf: Buffer.allocUnsafe(max),
      len: 0,
      field: -1,
      prefix0: 0,
      prefix1: 0,
      id: -1,
      lastMain: -1,
      ctx: {},
      queue: new Map(),
      db: this,
    }

    this.fileSystemPath = path
    this.splitDump = !!splitDump
    this.schemaTypesParsed = {}
    this.schema = { lastId: 0, types: {} }
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
    this.id = stringHash(this.fileSystemPath) >>> 0

    if (opts.clean) {
      try {
        await fs.rm(this.fileSystemPath, { recursive: true })
      } catch {}
    }

    try {
      await fs.mkdir(this.fileSystemPath, { recursive: true })
    } catch (err) {}
    if (this.splitDump) {
      const dumps = (await fs.readdir(this.fileSystemPath)).filter(
        (fname: string) => fname.endsWith('.sdb') && fname != 'common.sdb',
      )

      this.dbCtxExternal = db.start(this.fileSystemPath, null, false, this.id)
      db.loadCommon(join(this.fileSystemPath, 'common.sdb'), this.dbCtxExternal)
      dumps.forEach((fname) =>
        db.loadRange(join(this.fileSystemPath, fname), this.dbCtxExternal),
      )
    } else {
      // todo remove later
      const dumppath = join(this.fileSystemPath, 'data.sdb')
      const s = await fs.stat(dumppath).catch(() => null)
      this.dbCtxExternal = db.start(
        this.fileSystemPath,
        s ? dumppath : null,
        false,
        this.id,
      )
    }

    try {
      const schema = await fs.readFile(join(this.fileSystemPath, SCHEMA_FILE))
      if (schema) {
        // Prop need to not call setting in selva
        this.putSchema(JSON.parse(schema.toString()), true)
      }
    } catch (err) {}

    for (const key in this.schemaTypesParsed) {
      const def = this.schemaTypesParsed[key]
      const [total, lastId] = this.native.getTypeInfo(
        def.id,
        this.dbCtxExternal,
      )
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

  putSchema(schema: Schema, fromStart: boolean = false): Schema {
    if (!fromStart) {
      parse(schema)
    }

    const { lastId } = this.schema
    this.schema = {
      lastId,
      ...schema,
    }

    this.updateTypeDefs()

    if (!fromStart) {
      fs.writeFile(
        join(this.fileSystemPath, SCHEMA_FILE),
        JSON.stringify(this.schema),
      )
      let types = Object.keys(this.schemaTypesParsed)
      const s = schemaToSelvaBuffer(this.schemaTypesParsed)
      for (let i = 0; i < s.length; i++) {
        //  TYPE SELVA user Uint8Array(6) [ 1, 17, 23, 0, 11, 0 ]
        const type = this.schemaTypesParsed[types[i]]
        // TODO should not crash!
        try {
          this.native.updateSchemaType(type.id, s[i], this.dbCtxExternal)
        } catch (err) {
          console.error('Cannot update schema on selva', type.type, err, s[i])
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

  upsert(type: string, aliases: Record<string, string>, value: any) {
    console.warn('TODO upsert nice')
    for (const key in aliases) {
    }
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
    type: string,
    id?: number | ModifyRes | (number | ModifyRes)[],
  ): BasedDbQuery {
    if (Array.isArray(id)) {
      let i = id.length
      while (i--) {
        if (typeof id[i] == 'object') {
          // @ts-ignore
          id[i] = id[i].tmpId
        }
      }
    } else if (typeof id == 'object') {
      id = id.tmpId
    }
    return new BasedDbQuery(this, type, id as number | number[])
  }

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
    const pid = this.native.save(dumppath, this.dbCtxExternal)
    while (!rdy) {
      await wait(100)
      if (this.native.isSaveReady(pid, dumppath)) {
        rdy = true
        break
      }
    }
  }

  async stop(noSave?: boolean) {
    this.modifyCtx.len = 0
    if (!noSave) {
      await this.save()
    }
    db.stop(this.id, this.dbCtxExternal)
    await setTimeout()
  }

  async destroy() {
    return destroy(this)
  }
}
