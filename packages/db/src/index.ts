import { createHash } from 'crypto'
import { create, update } from './modify/index.js'
import { remove } from './modify/remove.js'
import { ModifyRes } from './modify/ModifyRes.js'
import { parse, Schema } from '@based/schema'
import {
  PropDef,
  SchemaTypeDef,
  createSchemaTypeDef,
  schemaToSelvaBuffer,
} from './schema/schema.js'
import { hashObjectIgnoreKeyOrder, stringHash } from '@saulx/hash'
import db from './native.js'
import { BasedDbQuery } from './query/BasedDbQuery.js'
import { flushBuffer } from './operations.js'
import { destroy } from './destroy.js'
import { setTimeout } from 'node:timers/promises'
import fs from 'node:fs/promises'
import { join } from 'node:path'
import { genId } from './schema/utils.js'
import { createTree as createMerkleTree } from '../src/csmt/index.js'
import { DbWorker, workers } from './workers/index.js'

export * from './schema/typeDef.js'
export * from './modify/index.js'
export const native = db
export { BasedQueryResponse } from './query/BasedIterable.js'

const SCHEMA_FILE = 'schema.json'
const COMMON_SDB_FILE = 'common.sdb'
const block_sdb_file = (typeId: number, start: number, end: number) =>
  `${typeId}_${start}_${end}.sdb`

export type ModCtx = {
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
  state: Uint32Array
  types: Set<number>
}

export class BasedDb {
  isDraining: boolean = false
  maxModifySize: number = 100 * 1e3 * 1e3
  modifyCtx: ModCtx
  blockSize = 10000

  id: number

  dbCtxExternal: any

  schema: Schema & { lastId: number }

  schemaTypesParsed: { [key: string]: SchemaTypeDef } = {}

  // total write time until .drain is called manualy
  writeTime: number = 0

  native = db

  fileSystemPath: string

  workers: DbWorker[]

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
    const sab = new SharedArrayBuffer(max)
    const sab2 = new SharedArrayBuffer(4)
    const state = new Uint32Array(sab2)

    this.modifyCtx = {
      max,
      hasStringField: -1,
      mergeMainSize: 0,
      mergeMain: null,
      buf: Buffer.from(sab),
      len: 0,
      field: -1,
      prefix0: 0,
      prefix1: 0,
      id: -1,
      lastMain: -1,
      ctx: {},
      queue: new Map(),
      db: this,
      types: new Set(),
      state,
    }

    this.fileSystemPath = path
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
    console.log('start')
    this.id = stringHash(this.fileSystemPath) >>> 0

    if (opts.clean) {
      try {
        await fs.rm(this.fileSystemPath, { recursive: true })
      } catch {}
    }

    try {
      await fs.mkdir(this.fileSystemPath, { recursive: true })
    } catch (err) {}
    const dumps = (await fs.readdir(this.fileSystemPath)).filter(
      (fname: string) => fname.endsWith('.sdb') && fname != COMMON_SDB_FILE,
    )

    this.dbCtxExternal = db.start(this.fileSystemPath, false, this.id)

    db.loadCommon(
      join(this.fileSystemPath, COMMON_SDB_FILE),
      this.dbCtxExternal,
    )

    dumps.forEach((fname) => {
      const err = db.loadRange(
        join(this.fileSystemPath, fname),
        this.dbCtxExternal,
      )
      if (err) {
        console.log(`Failed to load a range. file: "${fname}": ${err}`)
      }
    })

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

    this.workers = workers(this, 2)

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
    let err: number
    const ts = Date.now()
    const mt = createMerkleTree(() => createHash('sha1'))

    err = this.native.saveCommon(
      join(this.fileSystemPath, COMMON_SDB_FILE),
      this.dbCtxExternal,
    )
    if (err) {
      console.error(`Save common failed: ${err}`)
    }

    for (const key in this.schemaTypesParsed) {
      const def = this.schemaTypesParsed[key]
      const [_total, lastId] = this.native.getTypeInfo(
        def.id,
        this.dbCtxExternal,
      )
      const step = this.blockSize

      for (let start = 1; start <= lastId; start += step) {
        const end = start + step - 1
        const file = block_sdb_file(def.id, start, end)
        const path = join(this.fileSystemPath, file)
        const hash = Buffer.allocUnsafe(16)
        err = this.native.saveRange(
          path,
          def.id,
          start,
          end,
          this.dbCtxExternal,
          hash,
        )
        if (err) {
          console.error(`Save ${def.id}:${start}-${end} failed: ${err}`)
          continue
        }

        const mtKey = def.id * 4294967296 + start
        mt.insert(mtKey, hash, { file, start, end })
      }
    }

    const dumps: {
      file: string
      hash?: string
      start?: number
      end?: number
    }[] = [
      {
        file: COMMON_SDB_FILE,
      },
    ]
    mt.visitLeafNodes((leaf) =>
      dumps.push({ ...leaf.data, hash: leaf.hash.toString('hex') }),
    )
    const data = {
      ts,
      blockSize: this.blockSize,
      hash: mt.getRoot().hash.toString('hex'),
      dumps,
    }
    fs.appendFile(
      join(this.fileSystemPath, 'writelog.json'),
      JSON.stringify(data),
      { flag: 'w', flush: true },
    )
  }

  async stop(noSave?: boolean) {
    this.modifyCtx.len = 0
    if (!noSave) {
      await this.save()
    }
    db.stop(this.dbCtxExternal)
    await setTimeout()
  }

  async destroy() {
    return destroy(this)
  }
}
