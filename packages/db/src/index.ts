import { createHash } from 'crypto'
import { ModifyRes } from './modify/ModifyRes.js'
import { parse, Schema } from '@based/schema'
import {
  // PropDef,
  SchemaTypeDef,
  createSchemaTypeDef,
  schemaToSelvaBuffer,
} from './schema/schema.js'
import { wait } from '@saulx/utils'
import { hashObjectIgnoreKeyOrder, hash, stringHash } from '@saulx/hash'
import db from './native.js'
import { BasedDbQuery } from './query/BasedDbQuery.js'
import { DbWorker, ModifyCtx, flushBuffer, startWorker } from './operations.js'
import { destroy } from './destroy.js'
import { setTimeout } from 'node:timers/promises'
import fs from 'node:fs/promises'
import { join } from 'node:path'
import { genId } from './schema/utils.js'
import { Csmt, createTree as createMerkleTree } from '../src/csmt/index.js'
import { create, remove, update } from './modify/index.js'

export * from './schema/typeDef.js'
export * from './modify/modify.js'

const SCHEMA_FILE = 'schema.json'
const WRITELOG_FILE = 'writelog.json'
const COMMON_SDB_FILE = 'common.sdb'
const block_sdb_file = (typeId: number, start: number, end: number) =>
  `${typeId}_${start}_${end}.sdb`

export { ModifyCtx } // TODO move this somewhere
type Writelog = {
  ts: number
  types: { [t: number]: { lastId: number; blockSize: number } }
  hash?: string
  commonDump: string
  rangeDumps: {
    [t: number]: {
      // TODO add type
      file: string
      hash: string
      start: number
      end: number
    }[]
  }
}

type CsmtNodeRange = {
  file: string
  typeId: number
  start: number
  end: number
}

const DEFAULT_BLOCK_SIZE = 100_000
const makeCsmtKey = (typeId: number, start: number) =>
  typeId * 4294967296 + start
const destructureCsmtKey = (key: number) => [
  (key / 4294967296) | 0,
  (key >>> 31) * 2147483648 + (key & 0x7fffffff),
]
const makeCsmtKeyFromNodeId = (
  typeId: number,
  blockSize: number,
  nodeId: number,
) => {
  const tmp = nodeId - +!(nodeId % blockSize)
  return typeId * 4294967296 + ((tmp / blockSize) | 0) * blockSize + 1
}

export class BasedDb {
  writing: ModifyCtx[] = []
  isDraining: boolean = false
  maxModifySize: number = 100 * 1e3 * 1e3
  modifyCtx: ModifyCtx

  private dirtyRanges = new Set<number>()
  private csmtHashFun = db.createHash()
  private createCsmtHashFun = () => {
    // We can just reuse it as long as we only have one tree.
    this.csmtHashFun.reset()
    return this.csmtHashFun
  }
  merkleTree = createMerkleTree(this.createCsmtHashFun)

  id: number

  dbCtxExternal: any

  schema: Schema & { lastId: number }

  schemaTypesParsed: { [key: string]: SchemaTypeDef } = {}

  // total write time until .drain is called manualy
  writeTime: number = 0

  native = db

  fileSystemPath: string

  workers: DbWorker[] = []
  noCompression: boolean
  concurrency: number
  constructor({
    path,
    maxModifySize,
    noCompression,
    concurrency,
  }: {
    path: string
    maxModifySize?: number
    fresh?: boolean
    noCompression?: boolean
    concurrency?: number
  }) {
    if (maxModifySize) {
      this.maxModifySize = maxModifySize
    }
    this.modifyCtx = new ModifyCtx(this)
    this.noCompression = noCompression || false
    this.fileSystemPath = path
    this.schemaTypesParsed = {}
    this.schema = { lastId: 0, types: {} }
    this.concurrency = concurrency || 0
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

    this.dbCtxExternal = db.start(this.fileSystemPath, false, this.id)

    let writelog: Writelog = null
    try {
      writelog = JSON.parse(
        (
          await fs.readFile(join(this.fileSystemPath, WRITELOG_FILE))
        ).toString(),
      )

      // Load the common dump
      db.loadCommon(
        join(this.fileSystemPath, writelog.commonDump),
        this.dbCtxExternal,
      )

      // Load all range dumps
      for (const typeId in writelog.rangeDumps) {
        const dumps = writelog.rangeDumps[typeId]
        for (const dump of dumps) {
          const fname = dump.file
          const err = db.loadRange(
            join(this.fileSystemPath, fname),
            this.dbCtxExternal,
          )
          if (err) {
            console.log(`Failed to load a range. file: "${fname}": ${err}`)
          }
        }
      }

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
      def.lastId = writelog?.types[def.id].lastId || lastId
      def.blockSize = writelog?.types[def.id].blockSize || DEFAULT_BLOCK_SIZE

      const step = def.blockSize
      for (let start = 1; start <= lastId; start += step) {
        const end = start + step - 1
        const hash = Buffer.allocUnsafe(16)
        this.native.getNodeRangeHash(
          def.id,
          start,
          end,
          hash,
          this.dbCtxExternal,
        )

        //console.log(`load range ${def.id}:${start}-${end} hash:`, hash)

        const mtKey = makeCsmtKey(def.id, start)
        this.merkleTree.insert(mtKey, hash, { file: '', start, end })
      }
    }

    if (writelog?.hash) {
      const oldHash = Buffer.from(writelog.hash, 'hex')
      const newHash = this.merkleTree.getRoot()?.hash
      if (oldHash.compare(newHash) != 0) {
        console.error(
          `WARN: CSMT hash mismatch: ${writelog.hash} != ${newHash.toString('hex')}`,
        )
      }
    }

    let i = this.concurrency
    while (i--) {
      startWorker(this)
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
        def.blockSize = DEFAULT_BLOCK_SIZE // TODO This should come from somewhere else
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

  markNodeDirty(schema: SchemaTypeDef, nodeId: number): void {
    this.dirtyRanges.add(makeCsmtKeyFromNodeId(schema.id, schema.blockSize, nodeId))
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

  async drain() {
    if (!this.workers.length) {
      flushBuffer(this)
      const t = this.writeTime
      this.writeTime = 0
      return t
    }
    return new Promise((resolve) => {
      flushBuffer(this, resolve)
    })
  }

  async save() {
    let err: number
    const ts = Date.now()

    err = this.native.saveCommon(
      join(this.fileSystemPath, COMMON_SDB_FILE),
      this.dbCtxExternal,
    )
    if (err) {
      console.error(`Save common failed: ${err}`)
    }

    // TODO Make this nicely somewhere else
    const typeIdMap = {}
    for (const typeName in this.schemaTypesParsed) {
      const type = this.schemaTypesParsed[typeName]
      const typeId = type.id
      typeIdMap[typeId] = type
    }

    for (const mtKey of this.dirtyRanges) {
      const [typeId, start] = destructureCsmtKey(mtKey)
      const end = start + typeIdMap[typeId].blockSize - 1
      const file = block_sdb_file(typeId, start, end)
      const path = join(this.fileSystemPath, file)
      const hash = Buffer.allocUnsafe(16)
      err = this.native.saveRange(
        path,
        typeId,
        start,
        end,
        this.dbCtxExternal,
        hash,
      )
      if (err) {
        console.error(`Save ${typeId}:${start}-${end} failed: ${err}`)
        return // TODO What to do with the merkle tree in this situation?
      }

      // console.log(`save range ${typeId}:${start}-${end} hash:`, hash)

      this.merkleTree.delete(mtKey)
      this.merkleTree.insert(mtKey, hash, { file, start, end })
    }
    this.dirtyRanges.clear()

    const types: Writelog['types'] = {}
    for (const key in this.schemaTypesParsed) {
      const def = this.schemaTypesParsed[key]
      types[def.id] = { lastId: def.lastId, blockSize: def.blockSize }
    }

    const dumps: Writelog['rangeDumps'] = {}
    for (const key in this.schemaTypesParsed) {
      const def = this.schemaTypesParsed[key]
      dumps[def.id] = []
    }
    this.merkleTree.visitLeafNodes((leaf) => {
      const [typeId] = destructureCsmtKey(leaf.key)
      const data: CsmtNodeRange = leaf.data
      dumps[typeId].push({ ...data, hash: leaf.hash.toString('hex') })
    })

    const data: Writelog = {
      ts,
      types,
      commonDump: COMMON_SDB_FILE,
      rangeDumps: dumps,
    }
    const mtRoot = this.merkleTree.getRoot()
    if (mtRoot) {
      data.hash = mtRoot.hash.toString('hex')
    }
    fs.appendFile(
      join(this.fileSystemPath, WRITELOG_FILE),
      JSON.stringify(data),
      { flag: 'w', flush: true },
    )
  }

  async stop(noSave?: boolean) {
    this.modifyCtx.len = 0
    await Promise.all(
      this.workers.map(({ worker }) => {
        return worker.terminate()
      }),
    )
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
