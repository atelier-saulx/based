import { hashObjectIgnoreKeyOrder } from '@saulx/hash'
import native from '../native.js'
import { rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { getPropType, parse, Schema, StrictSchema } from '@based/schema'
import { PropDef, SchemaTypeDef } from './schema/types.js'
import { genId, genRootId } from './schema/utils.js'
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

  updateCtx(address: BigInt): Promise<void> {
    this.channel.postMessage(address)
    return new Promise(this.callback)
  }

  getQueryBuf(buf): Promise<Buffer> {
    transferList[0] = buf.buffer
    this.channel.postMessage(buf, transferList)
    return new Promise(this.callback)
  }
}

export class DbServer {
  modifyBuf: SharedArrayBuffer
  dbCtxExternal: any // pointer to zig dbCtx
  schema: StrictSchema & { lastId: number } = {
    lastId: 1, // we reserve one for root props
    types: {},
  }
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

  hasSortIndex(typeId: number, field: number, start: number): boolean {
    let types = this.sortIndexes[typeId]
    if (!types) {
      types = this.sortIndexes[typeId] = {}
    }
    let fields = types[field]
    if (!fields) {
      fields = types[field] = {}
    }
    let sortIndex = fields[start]
    if (sortIndex) {
      return true
    }
    return false
  }

  createSortIndexBuffer(typeId: number, field: number, start: number): any {
    const buf = Buffer.allocUnsafe(8)
    buf.writeUint16LE(typeId, 0)
    buf[2] = field
    buf.writeUint16LE(start, 3)
    let typeDef: SchemaTypeDef
    let prop: PropDef
    for (const t in this.schemaTypesParsed) {
      typeDef = this.schemaTypesParsed[t]
      if (typeDef.id == typeId) {
        for (const p in typeDef.props) {
          const propDef = typeDef.props[p]
          if (propDef.prop == field && propDef.start == start) {
            prop = propDef
            break
          }
        }
        break
      }
    }
    if (!typeDef) {
      throw new Error(`Cannot find type id on db from query for sort ${typeId}`)
    }
    if (!prop) {
      throw new Error(`Cannot find prop on db from query for sort ${field}`)
    }
    buf.writeUint16LE(prop.len, 5)
    buf[7] = prop.typeIndex
    // put in modify stuff
    const sortIndex = native.createSortIndex(buf, this.dbCtxExternal)
    const types = this.sortIndexes[typeId]
    const fields = types[field]
    fields[start] = sortIndex
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

  putSchema(
    schema: Schema | StrictSchema,
    fromStart: boolean = false,
  ): StrictSchema {
    const strictSchema = fromStart
      ? (schema as StrictSchema)
      : parse(schema).schema

    const { lastId } = this.schema
    this.schema = {
      lastId,
      ...strictSchema,
    }

    if (strictSchema.props) {
      this.schema.types ??= {}
      const props = { ...strictSchema.props }
      for (const key in props) {
        const prop = props[key]
        const propType = getPropType(prop)
        let refProp
        if (propType === 'reference') {
          refProp = prop
        } else if (propType === 'references') {
          refProp = prop.items
        }
        if (refProp) {
          const type = this.schema.types[refProp.ref]
          const inverseKey = '_' + key
          this.schema.types[refProp.ref] = {
            ...type,
            props: {
              ...type.props,
              [inverseKey]: {
                items: {
                  ref: '_root',
                  prop: key,
                },
              },
            },
          }
          refProp.prop = inverseKey
        }
      }
      // @ts-ignore This creates an internal type to use for root props
      this.schema.types._root = {
        id: genRootId(),
        props,
      }
      delete this.schema.props
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

      if (strictSchema.props) {
        // insert a root node
        this.modify(Buffer.from([2, 1, 255, 0, 0, 9, 1, 0, 0, 0, 7, 1, 0, 1]))
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
        def.blockCapacity = field === '_root' ? 2 : DEFAULT_BLOCK_CAPACITY // TODO This should come from somewhere else
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
      const queryType = buf[0]
      if (queryType == 2) {
        const s = 13 + buf.readUint16LE(11)
        const sortLen = buf.readUint16LE(s)
        if (sortLen) {
          const typeId = buf.readUint16LE(1)
          const sort = buf.slice(s + 2, s + 2 + sortLen)
          const field = sort[1]
          const start = sort.readUint16LE(2 + 1)
          if (!this.hasSortIndex(typeId, field, start)) {
            if (this.processingQueries) {
              return new Promise((resolve) => {
                this.queryQueue.set(resolve, buf)
              })
            }
            this.createSortIndexBuffer(typeId, field, start)
          }
        }
      } else if (queryType == 1) {
        // This will be more advanced - sometimes has indexes / sometimes not
      }
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
