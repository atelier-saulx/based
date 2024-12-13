import { hashObjectIgnoreKeyOrder } from '@saulx/hash'
import native from '../native.js'
import { rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { parse, Schema } from '@based/schema'
import { SchemaTypeDef } from './schema/types.js'
import { genId } from './schema/utils.js'
import { createSchemaTypeDef } from './schema/typeDef.js'
import { schemaToSelvaBuffer } from './schema/selvaBuffer.js'
import { createTree } from './csmt/index.js'
import { start } from './start.js'
import {
  CsmtNodeRange,
  foreachDirtyBlock,
  makeCsmtKeyFromNodeId,
} from './tree.js'
import { save } from './save.js'
import { Worker, MessageChannel, MessagePort } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import { setTimeout } from 'node:timers/promises'

const SCHEMA_FILE = 'schema.json'
const DEFAULT_BLOCK_CAPACITY = 100_000
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const workerPath = join(__dirname, 'worker.js')

const transferList = new Array(1)

export class DbWorker {
  constructor(address: BigInt, db: DbServer) {
    const { port1, port2 } = new MessageChannel()

    this.db = db
    this.channel = port1
    this.worker = new Worker(workerPath, {
      workerData: {
        channel: port2,
        address,
      },
      transferList: [port2],
    })

    port1.on('message', (buf) => {
      this.resolvers.shift()(buf)
      this.db.onQueryEnd()
    })
  }

  db: DbServer
  channel: MessagePort
  worker: Worker
  resolvers: any[] = []

  callback = (resolve) => {
    this.resolvers.push(resolve)
  }

  getQueryBuf(buf): Promise<Buffer> {
    transferList[0] = buf.buffer
    this.channel.postMessage(buf, transferList)
    return new Promise(this.callback)
  }
}

export class DbServer {
  modifyBuf: SharedArrayBuffer
  dbCtxExternal: any
  schema: Schema & { lastId: number } = { lastId: 0, types: {} }
  schemaTypesParsed: { [key: string]: SchemaTypeDef } = {}
  fileSystemPath: string
  maxModifySize: number
  merkleTree: ReturnType<typeof createTree>

  dirtyRanges = new Set<number>()
  csmtHashFun = native.createHash()
  workers: DbWorker[] = []
  availableWorkerIndex: number = -1
  processingQueries = 0
  modifyQueue: Buffer[] = []
  queryQueue: Map<Function, Buffer> = new Map()
  stopped: boolean

  constructor({
    path,
    maxModifySize = 100 * 1e3 * 1e3,
  }: {
    path: string
    maxModifySize?: number
  }) {
    this.maxModifySize = maxModifySize
    this.fileSystemPath = path
    this.sortIndexes = {}
  }

  start = start
  save = save

  createCsmtHashFun = () => {
    // We can just reuse it as long as we only have one tree.
    this.csmtHashFun.reset()
    return this.csmtHashFun
  }

  sortIndexes: {
    [type: number]: {
      [field: number]: {
        [start: number]: any
      }
    }
  }

  createSortIndex(type: string, field: string): any {
    const t = this.schemaTypesParsed[type]
    const prop = t.props[field]

    let types = this.sortIndexes[t.id]
    if (!types) {
      types = this.sortIndexes[t.id] = {}
    }
    let fields = types[prop.prop]
    if (!fields) {
      fields = types[prop.prop] = {}
    }
    let sortIndex = fields[prop.start]
    if (sortIndex) {
      return sortIndex
    }

    const buf = Buffer.allocUnsafe(8)
    // size [2 type] [1 field] [2 start] [2 len]
    buf.writeUint16LE(t.id, 0)
    buf[2] = prop.prop
    buf.writeUint16LE(prop.start, 3)
    buf.writeUint16LE(prop.len, 5)
    buf[7] = prop.typeIndex
    sortIndex = native.createSortIndex(buf, this.dbCtxExternal)
    fields[prop.start] = sortIndex
    return sortIndex
  }

  updateMerkleTree(): void {
    foreachDirtyBlock(this, (mtKey, typeId, start, end) => {
      const oldLeaf = this.merkleTree.search(mtKey)
      const hash = Buffer.allocUnsafe(16)
      native.getNodeRangeHash(typeId, start, end, hash, this.dbCtxExternal)

      if (oldLeaf) {
        if (oldLeaf.hash.equals(hash)) {
          return
        }
        try {
          this.merkleTree.delete(mtKey)
        } catch (err) {}
      }

      const data: CsmtNodeRange = {
        file: '', // not saved yet
        typeId,
        start,
        end,
      }
      this.merkleTree.insert(mtKey, hash, data)
    })
  }

  markNodeDirty(schema: SchemaTypeDef, nodeId: number): void {
    this.dirtyRanges.add(
      makeCsmtKeyFromNodeId(schema.id, schema.blockCapacity, nodeId),
    )
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
      writeFile(
        join(this.fileSystemPath, SCHEMA_FILE),
        JSON.stringify(this.schema),
      ).catch((err) => console.error(SCHEMA_FILE, err))
      let types = Object.keys(this.schemaTypesParsed)
      const s = schemaToSelvaBuffer(this.schemaTypesParsed)
      for (let i = 0; i < s.length; i++) {
        //  TYPE SELVA user Uint8Array(6) [ 1, 17, 23, 0, 11, 0 ]
        const type = this.schemaTypesParsed[types[i]]
        // TODO should not crash!
        try {
          native.updateSchemaType(type.id, s[i], this.dbCtxExternal)
        } catch (err) {
          console.error('Cannot update schema on selva', type.type, err, s[i])
        }
      }
    }

    return this.schema
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
        def.blockCapacity = DEFAULT_BLOCK_CAPACITY // TODO This should come from somewhere else
        this.schemaTypesParsed[field] = def
      }
    }
  }

  modify(buf: Buffer) {
    if (this.processingQueries) {
      this.modifyQueue.push(Buffer.from(buf))
    } else {
      native.modify(buf, this.dbCtxExternal)
    }
  }

  getQueryBuf(buf: Buffer): Promise<Uint8Array> {
    if (this.modifyQueue.length) {
      return new Promise((resolve) => {
        this.queryQueue.set(resolve, buf)
      })
    } else {
      this.processingQueries++
      this.availableWorkerIndex =
        (this.availableWorkerIndex + 1) % this.workers.length
      return this.workers[this.availableWorkerIndex].getQueryBuf(buf)
    }
  }

  onQueryEnd() {
    this.processingQueries--
    if (this.processingQueries === 0) {
      if (this.modifyQueue.length) {
        for (const buf of this.modifyQueue) {
          native.modify(buf, this.dbCtxExternal)
        }
        this.modifyQueue = []
      }
      if (this.queryQueue.size) {
        for (const [resolve, buf] of this.queryQueue) {
          resolve(this.getQueryBuf(buf))
        }
        this.queryQueue.clear()
      }
    }
  }

  async stop(noSave?: boolean) {
    if (this.stopped) {
      return
    }

    if (!noSave) {
      await this.save()
    }

    await Promise.all(this.workers.map(({ worker }) => worker.terminate()))
    this.workers = []
    native.stop(this.dbCtxExternal)
    await setTimeout()
  }

  async destroy() {
    await this.stop(true)
    await rm(this.fileSystemPath, { recursive: true }).catch((err) =>
      console.warn('Error removing dump folder', err.message),
    )
  }
}
