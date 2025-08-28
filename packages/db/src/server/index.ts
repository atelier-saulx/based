import native from '../native.js'
import { rm } from 'node:fs/promises'
import { langCodesMap, LangName, MigrateFns, StrictSchema } from '@based/schema'
import { ID_FIELD_DEF, PropDef, SchemaTypeDef } from '@based/schema/def'
import { start, StartOpts } from './start.js'
import { VerifTree, destructureTreeKey, makeTreeKeyFromNodeId } from './tree.js'
import { save } from './save.js'
import { setTimeout } from 'node:timers/promises'
import { migrate } from './migrate/index.js'
import exitHook from 'exit-hook'
import { debugServer } from '../utils.js'
import { readUint16, readUint32, readUint64, writeUint32 } from '@based/utils'
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

  migrating: number = null
  saveInProgress: boolean = false
  fileSystemPath: string
  verifTree: VerifTree // should be updated only when saving/loading
  dirtyRanges = new Set<number>()
  ioWorker: IoWorker
  workers: QueryWorker[] = []
  availableWorkerIndex: number = -1
  activeReaders = 0 // processing queries or other DB reads
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

    if (process.stderr.isTTY) {
      //this.on('info', (v) => console.error('Info:', v))
      this.on('error', (v) => console.error('Error:', v))
    }

    if (debug) {
      debugServer(this)
    }
  }

  start(opts?: StartOpts) {
    this.stopped = false
    return start(this, opts)
  }

  save(opts?: { forceFullDump?: boolean }) {
    return save(this, opts)
  }

  async loadBlock(typeName: string, nodeId: number) {
    const def = this.schemaTypesParsed[typeName]
    if (!def) {
      throw new Error('Type not found')
    }

    const typeId = def.id
    const key = makeTreeKeyFromNodeId(typeId, def.blockCapacity, nodeId)
    const [, start] = destructureTreeKey(key)

    await loadBlock(this, def, start)
  }

  async unloadBlock(typeName: string, nodeId: number) {
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

    await unloadBlock(this, def, start)
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
                if (sortIndex.cnt < 1 && !this.activeReaders) {
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

    if (field === 255) {
      prop = ID_FIELD_DEF
      typeDef = this.schemaTypesParsedById[typeId]
    } else {
      typeDef = this.schemaTypesParsedById[typeId]
      for (const p in typeDef.props) {
        const propDef = typeDef.props[p]
        if (propDef.prop == field && propDef.start == start) {
          prop = propDef
          break
        }
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
    transformFns?: MigrateFns,
  ): Promise<SchemaChecksum> {
    if (this.stopped || !this.dbCtxExternal) {
      throw new Error('Db is stopped')
    }

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

  modify(
    payload: Uint8Array,
    skipParse?: boolean,
  ): Record<number, number> | null {
    const hash = readUint64(payload, 0)
    const contentEnd = readUint32(payload, payload.byteLength - 4)
    let result: Record<number, number>

    if (this.schema?.hash !== hash) {
      this.emit('info', 'Schema mismatch in write')
      return null
    }

    if (!skipParse) {
      result = {}
      let i = payload.byteLength - 4
      while (i > contentEnd) {
        const typeId = readUint16(payload, i - 6)
        const count = readUint32(payload, i - 4)
        const typeDef = this.schemaTypesParsedById[typeId]

        if (!typeDef) {
          console.error('Missing typeDef, cancel write', { typeId, count })
          this.emit('info', 'Missing typeDef, cancel write')
          return null
        }

        const lastId =
          typeDef.lastId ||
          native.getTypeInfo(typeDef.id, this.dbCtxExternal)[1]
        // TODO replace this with Ctx.created
        const offset = lastId
        // write the offset into payload for zig to use
        writeUint32(payload, offset, i - 4)
        result[typeId] = offset
        typeDef.lastId = lastId + count
        i -= 6
      }
    }

    const content = payload.subarray(8, contentEnd)
    const offsets = payload.subarray(contentEnd, payload.byteLength - 4)
    if (this.activeReaders) {
      this.modifyQueue.push(new Uint8Array(payload))
    } else {
      resizeModifyDirtyRanges(this)
      native.modify(
        content,
        offsets,
        this.dbCtxExternal,
        this.modifyDirtyRanges,
      )
      for (const key of this.modifyDirtyRanges) {
        if (key === 0) break
        this.dirtyRanges.add(key)
      }
    }

    return result
  }

  #expire() {
    resizeModifyDirtyRanges(this)
    native.modify(
      emptyUint8Array,
      emptyUint8Array,
      this.dbCtxExternal,
      this.modifyDirtyRanges,
    )
    for (const key of this.modifyDirtyRanges) {
      if (key === 0) break
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
            if (this.activeReaders) {
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
    if (this.activeReaders === 0) {
      if (this.modifyQueue.length) {
        const modifyQueue = this.modifyQueue
        this.modifyQueue = []
        for (const payload of modifyQueue) {
          this.modify(payload, true)
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

      await this.ioWorker.terminate()
      this.ioWorker = null
      await Promise.all(this.workers.map((worker) => worker.terminate()))
      this.workers = []
      native.stop(this.dbCtxExternal)
      this.dbCtxExternal = null
      await setTimeout(100)
    } catch (e) {
      this.stopped = false
      throw e
    }
  }

  async destroy() {
    await this.stop(true)
    if (this.fileSystemPath) {
      await rm(this.fileSystemPath, { recursive: true }).catch((err) => {})
    }
  }
}
