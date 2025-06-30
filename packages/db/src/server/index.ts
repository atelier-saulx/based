import native from '../native.js'
import { rm } from 'node:fs/promises'
import { langCodesMap, LangName, StrictSchema } from '@based/schema'
import { PropDef, SchemaTypeDef } from '@based/schema/def'
import { start, StartOpts } from './start.js'
import { VerifBlock, VerifTree, destructureTreeKey, makeTreeKey, makeTreeKeyFromNodeId } from './tree.js'
import { save } from './save.js'
import { setTimeout } from 'node:timers/promises'
import { migrate, TransformFns } from './migrate/index.js'
import exitHook from 'exit-hook'
import { debugServer } from '../utils.js'
import { readUint16, readUint32, readUint64 } from '@saulx/utils'
import { QueryType } from '../client/query/types.js'
import { strictSchemaToDbSchema } from './schema.js'
import { SchemaChecksum } from '../schema.js'
import { IoWorker } from './IoWorker.js'
import { QueryWorker } from './QueryWorker.js'
import { DbShared } from '../shared/DbBase.js'
import {
  setNativeSchema,
  setSchemaOnServer,
  writeSchemaFile,
} from './schema.js'
import { resizeModifyDirtyRanges } from './resizeModifyDirtyRanges.js'
import { loadBlock, unloadBlock } from './blocks.js'

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

export class DbServer extends DbShared {
  modifyDirtyRanges: Float64Array
  dbCtxExternal: any // pointer to zig dbCtx
  threadCtxExternal: any // pointer to zig dbCtx

  migrating: number = null
  saveInProgress: boolean = false
  fileSystemPath: string
  verifTree: VerifTree
  dirtyRanges = new Set<number>()
  ioWorker: IoWorker
  workers: QueryWorker[] = []
  availableWorkerIndex: number = -1
  processingQueries = 0
  modifyQueue: Uint8Array[] = []
  queryQueue: Map<Function, Uint8Array> = new Map()
  stopped: boolean // = true does not work
  unlistenExit: ReturnType<typeof exitHook>
  saveIntervalInSeconds?: number
  saveInterval?: NodeJS.Timeout
  delayInMs?: number

  constructor({
    path,
    debug,
    saveIntervalInSeconds,
  }: {
    path: string
    debug?: boolean
    saveIntervalInSeconds?: number
  }) {
    super()
    this.fileSystemPath = path
    this.sortIndexes = {}
    this.saveIntervalInSeconds = saveIntervalInSeconds

    if (debug) {
      debugServer(this)
    }
  }

  start(opts?: StartOpts) {
    this.stopped = false
    return start(this, opts)
  }

  save(opts?: { forceFullDump?: boolean }) {
    return save(this, false, opts?.forceFullDump ?? false)
  }

  loadBlock(typeName: string, nodeId: number) {
    const def = this.schemaTypesParsed[typeName]
    if (!def) {
      throw new Error('Type not found')
    }

    const typeId = def.id
    const key = makeTreeKeyFromNodeId(typeId, def.blockCapacity, nodeId)
    const [, start] = destructureTreeKey(key)

    const block = this.verifTree.getBlock(key)
    if (!block) {
      throw new Error('Block not found')
    }

    loadBlock(this, def, start)
  }

  unloadBlock(typeName: string, nodeId: number) {
    const def = this.schemaTypesParsed[typeName]
    if (!def) {
      throw new Error('Type not found')
    }

    const typeId = def.id
    const key = makeTreeKeyFromNodeId(typeId, def.blockCapacity, nodeId)
    const [, start] = destructureTreeKey(key)

    const block = this.verifTree.getBlock(key)
    if (!block) {
      throw new Error('Block not found')
    }

    unloadBlock(this, def, start)
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

  async setSchema(
    strictSchema: StrictSchema,
    transformFns?: TransformFns,
  ): Promise<SchemaChecksum> {
    const schema = strictSchemaToDbSchema(strictSchema)

    if (schema.hash === this.schema?.hash) {
      // Todo something for sending back to actual client
      return schema.hash
    }

    if (this.schema) {
      // skip if allrdy doing the same
      if (schema.hash === this.migrating) {
        await this.once('schema')
        return this.schema.hash
      }

      await migrate(this, this.schema, schema, transformFns)

      // if (this.schema.hash !== schema.hash) {
      //   // process.nextTick(() => this.emit('schema', this.schema))
      //   await this.once('schema')
      // }
      // Handle this later if it gets changed back to the same schema do false
      // console.log(this.schema.hash == schema.hash)
      return this.schema.hash
    }

    setSchemaOnServer(this, schema)
    await writeSchemaFile(this, schema)
    await setNativeSchema(this, schema)

    process.nextTick(() => {
      this.emit('schema', this.schema)
    })

    return schema.hash
  }

  modify(bufWithHash: Uint8Array): Record<number, number> | null {
    const schemaHash = readUint64(bufWithHash, 0)
    if (schemaHash !== this.schema?.hash) {
      this.emit('info', 'Schema mismatch in modify')
      return null
    }

    const buf = bufWithHash.subarray(8)
    const offsets = {}
    const dataLen = readUint32(buf, buf.length - 4)
    let typesSize = readUint16(buf, dataLen)
    let i = dataLen + 2

    while (typesSize--) {
      const typeId = readUint16(buf, i)
      i += 2
      const startId = readUint32(buf, i)
      const def = this.schemaTypesParsedById[typeId]
      if (!def) {
        console.error(
          `Wrong cannot get def in modify ${typeId} ${schemaHash} ${this.schema?.hash}!}`,
        )
        return null
      }
      let offset = def.lastId - startId

      if (offset < 0) {
        offset = 0
      }

      buf[i++] = offset
      buf[i++] = offset >>> 8
      buf[i++] = offset >>> 16
      buf[i++] = offset >>> 24

      const lastId = readUint32(buf, i)
      i += 4

      def.lastId = lastId + offset
      offsets[typeId] = offset
    }

    if (this.processingQueries) {
      this.modifyQueue.push(new Uint8Array(bufWithHash))
    } else {
      this.#modify(buf)
    }

    return offsets
  }

  #modify(buf: Uint8Array) {
    if (this.stopped) {
      console.error('Db is stopped - trying to modify')
      return
    }

    const end = buf.length - 4
    const dataLen = readUint32(buf, end)
    let typesSize = readUint16(buf, dataLen)
    const typesLen = typesSize * 10
    const types = buf.subarray(dataLen + 2, dataLen + typesLen + 2)
    const data = buf.subarray(0, dataLen)

    let i = dataLen + 2

    while (typesSize--) {
      const typeId = readUint16(buf, i)
      const def = this.schemaTypesParsedById[typeId]
      const key = makeTreeKeyFromNodeId(def.id, def.blockCapacity, def.lastId)
      this.dirtyRanges.add(key)
      i += 10
    }

    const view = new DataView(buf.buffer, buf.byteOffset)
    while (i < end) {
      // const key = view.getFloat64(i, true)
      // These node ranges may not actually exist
      //this.dirtyRanges.add(key)
      i += 8
    }

    resizeModifyDirtyRanges(this)
    native.modify(data, types, this.dbCtxExternal, this.modifyDirtyRanges)
    for (let key of this.modifyDirtyRanges) {
      if (key === 0) {
        break
      }
      this.dirtyRanges.add(key)
    }
  }

  #expire() {
    resizeModifyDirtyRanges(this)
    native.modify(
      emptyUint8Array,
      emptyUint8Array,
      this.dbCtxExternal,
      this.modifyDirtyRanges,
    )
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
    const schemaChecksum = readUint64(buf, buf.byteLength - 8)
    if (schemaChecksum !== this.schema?.hash) {
      return Promise.resolve(new Uint8Array(1))
    }
    this.queryQueue.set(resolve, buf)
  }

  getQueryBuf(
    buf: Uint8Array,
    fromQueue: boolean = false,
  ): Promise<Uint8Array> {
    if (this.stopped) {
      console.error('Db is stopped - trying to query', buf.byteLength)
      return Promise.resolve(new Uint8Array(8))
    }
    if (this.modifyQueue.length) {
      return new Promise((resolve) => {
        this.addToQueryQueue(resolve, buf)
      })
    } else {
      const queryType = buf[0]
      if (queryType == QueryType.default) {
        // TODO: make a function for this!
        const s = 14 + readUint16(buf, 11)
        const sortLen = readUint16(buf, s)
        if (sortLen) {
          // make function for this
          const typeId = readUint16(buf, 1)
          const sort = buf.slice(s + 2, s + 2 + sortLen)
          const field = sort[1]
          const start = readUint16(sort, 3)
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
    if (this.processingQueries === 0) {
      if (this.modifyQueue.length) {
        const modifyQueue = this.modifyQueue
        this.modifyQueue = []
        for (const bufWithHash of modifyQueue) {
          const schemaHash = readUint64(bufWithHash, 0)
          if (schemaHash !== this.schema?.hash) {
            this.emit('info', 'Schema mismatch in modify')
            return null
          }
          const buf = bufWithHash.subarray(8)
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

      //this.ioWorker.terminate()
      await Promise.all(this.workers.map((worker) => worker.terminate()))
      this.workers = []
      native.stop(this.dbCtxExternal)
      await setTimeout(100)
    } catch (e) {
      this.stopped = false
      throw e
    }
  }

  async destroy() {
    await this.stop(true)
    if (this.fileSystemPath) {
      await rm(this.fileSystemPath, { recursive: true }).catch((err) => {
        // console.warn(
        //   'Error removing dump folder',
        //   this.fileSystemPath,
        //   err.message,
        // ),
      })
    }
  }
}
