import native from '../native.js'
import { rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  getPropType,
  langCodesMap,
  LangName,
  StrictSchema,
} from '@based/schema'
import {
  PropDef,
  SchemaTypeDef,
  updateTypeDefs,
  schemaToSelvaBuffer,
  SchemaTypesParsed,
  SchemaTypesParsedById,
} from '@based/schema/def'
import { createTree } from './csmt/index.js'
import { start } from './start.js'
import {
  CsmtNodeRange,
  foreachDirtyBlock,
  makeCsmtKey,
  makeCsmtKeyFromNodeId,
} from './tree.js'
import { save } from './save.js'
import { Worker, MessageChannel, MessagePort } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import { setTimeout } from 'node:timers/promises'
import { migrate, TransformFns } from './migrate/index.js'
import exitHook from 'exit-hook'
const SCHEMA_FILE = 'schema.json'
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const workerPath = join(__dirname, 'worker.js')

class SortIndex {
  constructor(buf: Buffer, dbCtxExternal: any) {
    this.buf = buf
    this.idx = native.createSortIndex(buf, dbCtxExternal)
  }
  buf: Buffer
  idx: any
  cnt = 0
}

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
      // TODO FIX TYPES CHECK IF THIS MAKES A COPY
      this.resolvers.shift()(new Uint8Array(buf))
      this.db.onQueryEnd()
    })
  }

  db: DbServer
  channel: MessagePort
  worker: Worker
  resolvers: any[] = []

  callback = (resolve) => {
    this.db.processingQueries++
    this.resolvers.push(resolve)
  }

  updateCtx(address: BigInt): Promise<void> {
    this.channel.postMessage(address)
    return new Promise(this.callback)
  }

  getQueryBuf(buf: Buffer): Promise<Uint8Array> {
    this.channel.postMessage(buf)
    return new Promise(this.callback)
  }
}

type OnSchemaChange = (schema: StrictSchema) => void

export class DbServer {
  modifyBuf: SharedArrayBuffer
  dbCtxExternal: any // pointer to zig dbCtx
  schema: StrictSchema & { lastId: number } = {
    lastId: 1, // we reserve one for root props
    types: {},
  }
  migrating: number = null
  schemaTypesParsed: SchemaTypesParsed = {}
  schemaTypesParsedById: SchemaTypesParsedById = {}
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
  onSchemaChange: OnSchemaChange
  unlistenExit: ReturnType<typeof exitHook>
  constructor({
    path,
    maxModifySize = 100 * 1e3 * 1e3,
    onSchemaChange,
  }: {
    path: string
    maxModifySize?: number
    onSchemaChange?: OnSchemaChange
  }) {
    this.maxModifySize = maxModifySize
    this.fileSystemPath = path
    this.sortIndexes = {}
    this.onSchemaChange = onSchemaChange
  }

  start(opts?: { clean?: boolean }) {
    return start(this, opts)
  }

  save() {
    return save(this)
  }

  createCsmtHashFun = () => {
    // We can just reuse it as long as we only have one tree.
    this.csmtHashFun.reset()
    return this.csmtHashFun
  }

  sortIndexes: {
    [type: number]: {
      [field: number]: {
        [start: number]: {
          [lang: number]: SortIndex
        }
      }
    }
  }

  cleanupTimer: NodeJS.Timeout

  cleanup() {
    if (!this.cleanupTimer) {
      // amount accessed
      // current mem available
      this.cleanupTimer = global.setTimeout(() => {
        this.cleanupTimer = null
        let remaining: boolean

        for (const type in this.sortIndexes) {
          for (const field in this.sortIndexes[type]) {
            for (const start in this.sortIndexes[type][field]) {
              for (const lang in this.sortIndexes[type][field][start]) {
                const sortIndex = this.sortIndexes[type][field][start][lang]
                sortIndex.cnt /= 2
                if (sortIndex.cnt < 1) {
                  native.destroySortIndex(sortIndex.buf, this.dbCtxExternal)
                  delete this.sortIndexes[type][field][start][lang]
                } else {
                  remaining = true
                }
              }
            }
          }
        }

        if (remaining) {
          this.cleanup()
        }
      }, 60e3)
    }
  }

  createSortIndex(
    type: string,
    field: string,
    lang: LangName = 'none',
  ): SortIndex {
    const t = this.schemaTypesParsed[type]
    const prop = t.props[field]
    const langCode =
      langCodesMap.get(lang ?? Object.keys(this.schema?.locales ?? 'en')[0]) ??
      0

    let types = this.sortIndexes[t.id]
    if (!types) {
      types = this.sortIndexes[t.id] = {}
    }
    let f = types[prop.prop]
    if (!f) {
      f = types[prop.prop] = {}
    }
    let fields = f[prop.start]
    if (!fields) {
      fields = f[prop.start] = {}
    }
    let sortIndex = fields[langCode]
    if (sortIndex) {
      return sortIndex
    }
    const buf = Buffer.allocUnsafe(8)
    // size [2 type] [1 field]  [2 start] [2 len] [propIndex] [lang]
    // call createSortBuf here
    buf.writeUint16LE(t.id, 0)
    buf[2] = prop.prop
    buf.writeUint16LE(prop.start, 3)
    buf.writeUint16LE(prop.len, 5)
    buf[7] = prop.typeIndex
    buf[8] = langCode
    sortIndex = new SortIndex(buf, this.dbCtxExternal)
    fields[langCode] = sortIndex
    return sortIndex
  }

  destroySortIndex(type: string, field: string, lang: LangName = 'none'): any {
    const t = this.schemaTypesParsed[type]
    const prop = t.props[field]

    let types = this.sortIndexes[t.id]
    if (!type) {
      return
    }
    let fields = types[prop.prop]
    if (!fields) {
      fields = types[prop.prop] = {}
    }
    let sortIndex = fields[prop.start]
    if (sortIndex) {
      // [2 type] [1 field] [2 start] [1 lang]

      const buf = Buffer.allocUnsafe(6)
      buf.writeUint16LE(t.id, 0)
      buf[2] = prop.prop
      buf.writeUint16LE(prop.start, 3)
      buf[5] =
        langCodesMap.get(
          lang ?? Object.keys(this.schema?.locales ?? 'en')[0],
        ) ?? 0
      native.destroySortIndex(buf, this.dbCtxExternal)
      delete fields[prop.start]
    }
  }

  getSortIndex(
    typeId: number,
    field: number,
    start: number,
    lang: number,
  ): SortIndex {
    let types = this.sortIndexes[typeId]
    if (!types) {
      types = this.sortIndexes[typeId] = {}
    }
    let f = types[field]
    if (!f) {
      f = types[field] = {}
    }
    let fields = f[start]
    if (!fields) {
      fields = f[start] = {}
    }
    return fields[lang]
  }

  migrateSchema(
    schema: StrictSchema,
    transform?: Record<
      string,
      (
        node: Record<string, any>,
      ) => Record<string, any> | [string, Record<string, any>]
    >,
  ) {
    return migrate(this, schema, transform)
  }

  createSortIndexBuffer(
    typeId: number,
    field: number,
    start: number,
    lang: number,
  ): SortIndex {
    const buf = Buffer.allocUnsafe(9)
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
    buf[8] = lang
    // put in modify stuff
    const sortIndex =
      this.getSortIndex(typeId, prop.prop, prop.start, lang) ??
      new SortIndex(buf, this.dbCtxExternal)
    const types = this.sortIndexes[typeId]
    const fields = types[field]
    fields[start][lang] = sortIndex
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

  putSchema(
    strictSchema: StrictSchema,
    fromStart: boolean = false,
    transformFns?: TransformFns,
  ) {
    if (!fromStart && Object.keys(this.schema.types).length > 0) {
      return this.migrateSchema(strictSchema, transformFns)
    }

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
        id: 1,
        props,
      }
      delete this.schema.props
    }

    for (const field in this.schema.types) {
      if (!('id' in this.schema.types[field])) {
        this.schema.lastId++
        this.schema.types[field].id = this.schema.lastId
      }
    }

    updateTypeDefs(
      this.schema,
      this.schemaTypesParsed,
      this.schemaTypesParsedById,
    )

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
          native.updateSchemaType(type.id, Buffer.from(s[i]), this.dbCtxExternal)
        } catch (err) {
          console.error('Cannot update schema on selva', type.type, err, s[i])
        }
      }

      if (strictSchema.props) {
        // insert a root node
        const data = [2, 1, 0, 0, 0, 17, 9, 1, 0, 0, 0, 7, 1, 0, 1]
        const blockKey = makeCsmtKey(1, 1)
        const buf = Buffer.alloc(data.length + 2 + 8 + 4)
        // add content
        buf.set(data)
        // add typesLen
        buf.writeDoubleLE(0, data.length)
        // add dirty key
        buf.writeDoubleLE(blockKey, data.length + 2)
        // add dataLen
        buf.writeUint32LE(data.length, buf.length - 4)
        this.modify(buf)
      }
    }

    this.onSchemaChange?.(this.schema)
    return this.schema
  }

  modify(buf: Buffer): Record<number, number> {
    const offsets = {}
    const dataLen = buf.readUint32LE(buf.length - 4)
    let typesSize = buf.readUint16LE(dataLen)
    let i = dataLen + 2

    while (typesSize--) {
      const typeId = buf.readUint16LE(i)
      i += 2
      const startId = buf.readUint32LE(i)
      const def = this.schemaTypesParsedById[typeId]
      const offset = def.lastId - startId

      buf.writeUint32LE(offset, i)

      i += 4
      const lastId = buf.readUint32LE(i)
      i += 4
      def.lastId = lastId + offset
      offsets[typeId] = offset
    }

    if (this.processingQueries) {
      this.modifyQueue.push(Buffer.from(buf))
    } else {
      this.#modify(buf)
    }

    return offsets
  }

  #modify(buf: Buffer) {
    const end = buf.length - 4
    const dataLen = buf.readUint32LE(end)
    let typesSize = buf.readUint16LE(dataLen)
    const typesLen = typesSize * 10
    const types = buf.subarray(dataLen + 2, dataLen + typesLen + 2)
    const data = buf.subarray(0, dataLen)

    let i = dataLen + 2

    while (typesSize--) {
      const typeId = buf.readUint16LE(i)
      const def = this.schemaTypesParsedById[typeId]
      const key = makeCsmtKeyFromNodeId(def.id, def.blockCapacity, def.lastId)
      this.dirtyRanges.add(key)
      i += 10
    }

    while (i < end) {
      const key = buf.readDoubleLE(i)
      this.dirtyRanges.add(key)
      i += 8
    }

    native.modify(data, types, this.dbCtxExternal)
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
          let sortIndex = this.getSortIndex(typeId, field, start, 0)
          if (!sortIndex) {
            if (this.processingQueries) {
              return new Promise((resolve) => {
                this.queryQueue.set(resolve, buf)
              })
            }
            sortIndex = this.createSortIndexBuffer(
              typeId,
              field,
              start,
              sort[sort.byteLength - 1],
            )
          }
          // increment
          sortIndex.cnt++
          this.cleanup()
        }
      } else if (queryType == 1) {
        // This will be more advanced - sometimes has indexes / sometimes not
      }

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
          this.#modify(buf)
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

    this.stopped = true
    clearTimeout(this.cleanupTimer)
    this.unlistenExit()

    try {
      if (!noSave) {
        await this.save()
      }

      await Promise.all(this.workers.map(({ worker }) => worker.terminate()))
      this.workers = []
      native.stop(this.dbCtxExternal)
      await setTimeout()
    } catch (e) {
      this.stopped = false
      throw e
    }
  }

  async destroy() {
    await this.stop(true)
    await rm(this.fileSystemPath, { recursive: true }).catch((err) =>
      console.warn(
        'Error removing dump folder',
        this.fileSystemPath,
        err.message,
      ),
    )
  }
}
