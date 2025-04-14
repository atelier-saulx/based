import native from '../native.js'
import createDbHash from './dbHash.js'
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
import { initCsmt, makeCsmtKey, makeCsmtKeyFromNodeId } from './tree.js'
import { save } from './save.js'
import { Worker, MessageChannel, MessagePort } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import { setTimeout } from 'node:timers/promises'
import { migrate, TransformFns } from './migrate/index.js'
import exitHook from 'exit-hook'
import { debugMode, debugServer } from '../utils.js'

export const SCHEMA_FILE = 'schema.json'
export const WRITELOG_FILE = 'writelog.json'
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const workerPath = join(__dirname, 'worker.js')
const emptyUint8Array = new Uint8Array(0)

class SortIndex {
  constructor(buf: Uint8Array, dbCtxExternal: any) {
    this.buf = buf
    this.idx = native.createSortIndex(buf, dbCtxExternal)
  }
  buf: Uint8Array
  idx: any
  cnt = 0
}

function readUint16LE(buf: Uint8Array, off: number): number {
  return buf[off] | (buf[off + 1] << 8)
}

function readUint32LE(buf: Uint8Array, off: number): number {
  return (
    buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24)
  )
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

  getQueryBuf(buf: Uint8Array): Promise<Uint8Array> {
    this.channel.postMessage(buf)
    return new Promise(this.callback)
  }
}

type OnSchemaChange = (schema: StrictSchema) => void

export class DbServer {
  modifyDirtyRanges: Float64Array
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
  csmtHashFun = createDbHash()
  workers: DbWorker[] = []
  availableWorkerIndex: number = -1
  processingQueries = 0
  modifyQueue: Uint8Array[] = []
  queryQueue: Map<Function, Uint8Array> = new Map()
  stopped: boolean
  onSchemaChange: OnSchemaChange
  unlistenExit: ReturnType<typeof exitHook>
  saveIntervalInSeconds?: number
  saveInterval?: NodeJS.Timeout

  constructor({
    path,
    maxModifySize = 100 * 1e3 * 1e3,
    onSchemaChange,
    debug,
    saveIntervalInSeconds,
  }: {
    path: string
    maxModifySize?: number
    onSchemaChange?: OnSchemaChange
    debug?: boolean
    saveIntervalInSeconds?: number
  }) {
    this.maxModifySize = maxModifySize
    this.fileSystemPath = path
    this.sortIndexes = {}
    this.onSchemaChange = onSchemaChange
    this.saveIntervalInSeconds = saveIntervalInSeconds
    if (debug) {
      debugServer(this)
    }
  }

  #resizeModifyDirtyRanges() {
    let maxNrChanges = 0

    for (const typeId in this.schemaTypesParsedById) {
      const def = this.schemaTypesParsedById[typeId]
      const lastId = def.lastId
      const blockCapacity = def.blockCapacity
      const tmp = lastId - +!(lastId % def.blockCapacity)
      const lastBlock = Math.ceil(
        (((tmp / blockCapacity) | 0) * blockCapacity + 1) / blockCapacity,
      )
      maxNrChanges += lastBlock
    }

    if (
      !this.modifyDirtyRanges ||
      this.modifyDirtyRanges.length < maxNrChanges
    ) {
      const min = Math.max(maxNrChanges * 1.2, 1024) | 0
      this.modifyDirtyRanges = new Float64Array(min)
    }
  }

  start(opts?: { clean?: boolean; hosted?: boolean }) {
    return start(this, opts)
  }

  save(opts?: { forceFullDump?: boolean }) {
    return save(this, false, opts?.forceFullDump ?? false)
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
                if (sortIndex.cnt < 1 && !this.processingQueries) {
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
    const buf = new Uint8Array(9)
    // size [2 type] [1 field]  [2 start] [2 len] [propIndex] [lang]
    // call createSortBuf here
    buf[0] = t.id
    buf[1] = t.id >>> 8
    buf[2] = prop.prop
    buf[3] = prop.start
    buf[4] = prop.start >>> 8
    buf[5] = prop.len
    buf[6] = prop.len >>> 8
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
      const buf = new Uint8Array(6)
      buf[0] = t.id
      buf[1] = t.id >>> 8
      buf[2] = prop.prop
      buf[3] = prop.start
      buf[4] = prop.start >>> 8
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
    const buf = new Uint8Array(9)
    buf[0] = typeId
    buf[1] = typeId >>> 8
    buf[2] = field
    buf[3] = start
    buf[4] = start >>> 8
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
    buf[5] = prop.len
    buf[6] = prop.len >>> 8
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

  setSchema(
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
      ).catch((err) => console.error('!!!', SCHEMA_FILE, err))
      let types = Object.keys(this.schemaTypesParsed)
      const s = schemaToSelvaBuffer(this.schemaTypesParsed)
      for (let i = 0; i < s.length; i++) {
        //  TYPE SELVA user Uint8Array(6) [ 1, 17, 23, 0, 11, 0 ]
        const type = this.schemaTypesParsed[types[i]]
        // TODO should not crash!
        try {
          native.updateSchemaType(
            type.id,
            new Uint8Array(s[i]),
            this.dbCtxExternal,
          )
        } catch (err) {
          console.error('Cannot update schema on selva', type.type, err, s[i])
        }
      }

      if (strictSchema.props) {
        // insert a root node
        // TODO fix this add it in schema at least
        const data = [2, 1, 0, 0, 0, 1, 9, 1, 0, 0, 0, 7, 1, 0, 1]
        const blockKey = makeCsmtKey(1, 1)
        const buf = new Uint8Array(data.length + 2 + 8 + 4)
        const view = new DataView(buf.buffer, 0, buf.byteLength)
        // add content
        buf.set(data)
        // add typesLen
        view.setFloat64(data.length, 0, true)
        // add dirty key
        view.setFloat64(data.length + 2, blockKey, true)
        // add dataLen
        view.setUint32(buf.length - 4, data.length, true)
        this.modify(buf)
      }

      initCsmt(this)
    }

    this.onSchemaChange?.(this.schema)

    return this.schema
  }

  modify(buf: Uint8Array): Record<number, number> {
    const offsets = {}
    const dataLen = readUint32LE(buf, buf.length - 4)
    let typesSize = readUint16LE(buf, dataLen)
    let i = dataLen + 2

    while (typesSize--) {
      const typeId = readUint16LE(buf, i)
      i += 2
      const startId = readUint32LE(buf, i)
      const def = this.schemaTypesParsedById[typeId]
      let offset = def.lastId - startId

      if (offset < 0) {
        offset = 0
      }

      buf[i++] = offset
      buf[i++] = offset >>> 8
      buf[i++] = offset >>> 16
      buf[i++] = offset >>> 24

      const lastId = readUint32LE(buf, i)
      i += 4

      def.lastId = lastId + offset

      offsets[typeId] = offset
    }
    // console.log('modify', this.processingQueries)
    if (this.processingQueries) {
      this.modifyQueue.push(new Uint8Array(buf))
    } else {
      this.#modify(buf)
    }

    return offsets
  }

  #modify(buf: Uint8Array) {
    const end = buf.length - 4
    const dataLen = readUint32LE(buf, end)
    let typesSize = readUint16LE(buf, dataLen)
    const typesLen = typesSize * 10
    const types = buf.subarray(dataLen + 2, dataLen + typesLen + 2)
    const data = buf.subarray(0, dataLen)

    let i = dataLen + 2

    while (typesSize--) {
      const typeId = readUint16LE(buf, i)
      const def = this.schemaTypesParsedById[typeId]
      const key = makeCsmtKeyFromNodeId(def.id, def.blockCapacity, def.lastId)
      this.dirtyRanges.add(key)
      i += 10
    }

    const view = new DataView(buf.buffer, buf.byteOffset)
    while (i < end) {
      const key = view.getFloat64(i, true)
      this.dirtyRanges.add(key)
      i += 8
    }

    this.#resizeModifyDirtyRanges()
    native.modify(data, types, this.dbCtxExternal, this.modifyDirtyRanges)
    for (let key of this.modifyDirtyRanges) {
      if (key === 0) {
        break
      }
      this.dirtyRanges.add(key)
    }
  }

  #expire() {
    this.#resizeModifyDirtyRanges()
    native.modify(emptyUint8Array, emptyUint8Array, this.dbCtxExternal, this.modifyDirtyRanges)
    for (let key of this.modifyDirtyRanges) {
      if (key === 0) {
        break
      }
      this.dirtyRanges.add(key)
    }
  }

  addToQueryQueue(resolve, buf) {
    if (this.queryQueue.size === 16777216) {
      resolve(new Error('Query queue exceeded'))
      return
    }
    this.queryQueue.set(resolve, buf)
  }

  getQueryBuf(
    buf: Uint8Array,
    fromQueue: boolean = false,
  ): Promise<Uint8Array> {
    if (this.modifyQueue.length) {
      return new Promise((resolve) => {
        this.addToQueryQueue(resolve, buf)
      })
    } else {
      const queryType = buf[0]
      if (queryType == 2) {
        const s = 13 + readUint16LE(buf, 11)
        const sortLen = readUint16LE(buf, s)
        if (sortLen) {
          const typeId = readUint16LE(buf, 1)
          const sort = buf.slice(s + 2, s + 2 + sortLen)
          const field = sort[1]
          const start = readUint16LE(sort, 3)
          let sortIndex = this.getSortIndex(typeId, field, start, 0)
          if (!sortIndex) {
            if (this.processingQueries) {
              return new Promise((resolve) => {
                this.addToQueryQueue(resolve, buf)
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

      if (!fromQueue) {
        this.#expire()
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
        const modifyQueue = this.modifyQueue
        this.modifyQueue = []
        for (const buf of modifyQueue) {
          this.#modify(buf)
        }
      }
      if (this.queryQueue.size) {
        const queryQueue = this.queryQueue
        this.queryQueue = new Map()
        this.#expire()
        for (const [resolve, buf] of queryQueue) {
          resolve(this.getQueryBuf(buf, true))
        }
      }
    }
  }

  async stop(noSave?: boolean) {
    if (this.stopped) {
      return
    }

    this.stopped = true
    this.unlistenExit()

    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer)
      this.cleanupTimer = null
    }

    if (this.saveInterval) {
      clearInterval(this.saveInterval)
      this.saveInterval = null
    }

    try {
      if (!noSave) {
        await this.save()
      }

      await Promise.all(this.workers.map(({ worker }) => worker.terminate()))
      this.workers = []
      native.stop(this.dbCtxExternal)
      await setTimeout(20)
    } catch (e) {
      this.stopped = false
      throw e
    }
  }

  async destroy() {
    await this.stop(true)
    await rm(this.fileSystemPath, { recursive: true }).catch((err) => {
      // console.warn(
      //   'Error removing dump folder',
      //   this.fileSystemPath,
      //   err.message,
      // ),
    })
  }
}
