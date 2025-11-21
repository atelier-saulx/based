import native from '../native.js'
import { rm } from 'node:fs/promises'
import {
  StrictSchema,
  langCodesMap,
  LangName,
  MigrateFns,
  SchemaChecksum,
  strictSchemaToDbSchema,
} from '@based/schema'
import { ID_FIELD_DEF, PropDef, SchemaTypeDef } from '@based/schema/def'
import { start, StartOpts } from './start.js'
import {
  BlockMap,
  destructureTreeKey,
  makeTreeKeyFromNodeId,
} from './blockMap.js'
import { migrate } from './migrate/index.js'
import exitHook from 'exit-hook'
import { debugServer } from '../utils.js'
import { readUint16, readUint32, readUint64 } from '@based/utils'
import { QueryType } from '../client/query/types.js'
import { DbShared } from '../shared/DbBase.js'
import {
  setNativeSchema,
  setSchemaOnServer,
  writeSchemaFile,
} from './schema.js'
import { loadBlock, save, SaveOpts, unloadBlock } from './blocks.js'
import { Subscriptions } from './subscription.js'

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
  dbCtxExternal: any // pointer to zig dbCtx
  subscriptions: Subscriptions = {
    subInterval: 200,
    active: 0,
    updateHandler: null,
    ids: new Map(),
    fullType: new Map(),
    updateId: 1,
    now: { listeners: new Set(), lastUpdated: 1 },
  }
  migrating: number = null
  saveInProgress: boolean = false
  fileSystemPath: string
  blockMap: BlockMap
  activeReaders = 0 // processing queries or other DB reads
  modifyQueue: Map<Function, Uint8Array> = new Map()
  queryQueue: Map<Function, Uint8Array> = new Map()
  stopped: boolean // = true does not work
  unlistenExit: ReturnType<typeof exitHook>
  saveIntervalInSeconds?: number
  saveInterval?: NodeJS.Timeout
  delayInMs?: number

  ids: Uint32Array // whats this

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

  save(opts?: SaveOpts) {
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

    const block = this.blockMap.getBlock(key)
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

  // cleanup() {
  // if (!this.cleanupTimer) {
  //   // amount accessed
  //   // current mem available
  //   this.cleanupTimer = global.setTimeout(() => {
  //     this.cleanupTimer = null
  //     let remaining: boolean
  //     for (const type in this.sortIndexes) {
  //       for (const field in this.sortIndexes[type]) {
  //         for (const start in this.sortIndexes[type][field]) {
  //           for (const lang in this.sortIndexes[type][field][start]) {
  //             const sortIndex = this.sortIndexes[type][field][start][lang]
  //             sortIndex.cnt /= 2
  //             if (sortIndex.cnt < 1 && !this.activeReaders) {
  //               native.destroySortIndex(sortIndex.buf, this.dbCtxExternal)
  //               delete this.sortIndexes[type][field][start][lang]
  //             } else {
  //               remaining = true
  //             }
  //           }
  //         }
  //       }
  //     }
  //     if (remaining) {
  //       this.cleanup()
  //     }
  //   }, 60e3)
  // }
  // }

  // createSortIndex(
  //   type: string,
  //   field: string,
  //   lang: LangName = 'none',
  // ): SortIndex {
  //   const t = this.schemaTypesParsed[type]
  //   const prop = t.props[field]
  //   const langCode =
  //     langCodesMap.get(lang ?? Object.keys(this.schema?.locales ?? 'en')[0]) ??
  //     0

  //   let types = this.sortIndexes[t.id]
  //   if (!types) {
  //     types = this.sortIndexes[t.id] = {}
  //   }
  //   let f = types[prop.prop]
  //   if (!f) {
  //     f = types[prop.prop] = {}
  //   }
  //   let fields = f[prop.start]
  //   if (!fields) {
  //     fields = f[prop.start] = {}
  //   }
  //   let sortIndex = fields[langCode]
  //   if (sortIndex) {
  //     return sortIndex
  //   }
  //   const buf = new Uint8Array(9)
  //   // size [2 type] [1 field]  [2 start] [2 len] [propIndex] [lang]
  //   // call createSortBuf here
  //   buf[0] = t.id
  //   buf[1] = t.id >>> 8
  //   buf[2] = prop.prop
  //   buf[3] = prop.start
  //   buf[4] = prop.start >>> 8
  //   buf[5] = prop.len
  //   buf[6] = prop.len >>> 8
  //   buf[7] = prop.typeIndex
  //   buf[8] = langCode
  //   sortIndex = new SortIndex(buf, this.dbCtxExternal)
  //   fields[langCode] = sortIndex
  //   return sortIndex
  // }

  // destroySortIndex(type: string, field: string, lang: LangName = 'none'): any {
  //   const t = this.schemaTypesParsed[type]
  //   const prop = t.props[field]

  //   let types = this.sortIndexes[t.id]
  //   if (!type) {
  //     return
  //   }
  //   let fields = types[prop.prop]
  //   if (!fields) {
  //     fields = types[prop.prop] = {}
  //   }
  //   let sortIndex = fields[prop.start]
  //   if (sortIndex) {
  //     const buf = new Uint8Array(6)
  //     buf[0] = t.id
  //     buf[1] = t.id >>> 8
  //     buf[2] = prop.prop
  //     buf[3] = prop.start
  //     buf[4] = prop.start >>> 8
  //     buf[5] =
  //       langCodesMap.get(
  //         lang ?? Object.keys(this.schema?.locales ?? 'en')[0],
  //       ) ?? 0
  //     native.destroySortIndex(buf, this.dbCtxExternal)
  //     delete fields[prop.start]
  //   }
  // }

  // getSortIndex(
  //   typeId: number,
  //   field: number,
  //   start: number,
  //   lang: number,
  // ): SortIndex {
  //   let types = this.sortIndexes[typeId]
  //   if (!types) {
  //     types = this.sortIndexes[typeId] = {}
  //   }
  //   let f = types[field]
  //   if (!f) {
  //     f = types[field] = {}
  //   }
  //   let fields = f[start]
  //   if (!fields) {
  //     fields = f[start] = {}
  //   }
  //   return fields[lang]
  // }

  // createSortIndexBuffer(
  //   typeId: number,
  //   field: number,
  //   start: number,
  //   lang: number,
  // ): SortIndex {
  //   const buf = new Uint8Array(9)
  //   buf[0] = typeId
  //   buf[1] = typeId >>> 8
  //   buf[2] = field
  //   buf[3] = start
  //   buf[4] = start >>> 8
  //   let typeDef: SchemaTypeDef
  //   let prop: PropDef

  //   if (field === 255) {
  //     prop = ID_FIELD_DEF
  //     typeDef = this.schemaTypesParsedById[typeId]
  //   } else {
  //     typeDef = this.schemaTypesParsedById[typeId]
  //     for (const p in typeDef.props) {
  //       const propDef = typeDef.props[p]
  //       if (propDef.prop == field && propDef.start == start) {
  //         prop = propDef
  //         break
  //       }
  //     }
  //   }

  //   if (!typeDef) {
  //     throw new Error(`Cannot find type id on db from query for sort ${typeId}`)
  //   }

  //   if (!prop) {
  //     throw new Error(`Cannot find prop on db from query for sort ${field}`)
  //   }

  //   buf[5] = prop.len
  //   buf[6] = prop.len >>> 8
  //   buf[7] = prop.typeIndex
  //   buf[8] = lang
  //   // put in modify stuff
  //   const sortIndex =
  //     this.getSortIndex(typeId, prop.prop, prop.start, lang) ??
  //     new SortIndex(buf, this.dbCtxExternal)
  //   const types = this.sortIndexes[typeId]
  //   const fields = types[field]
  //   fields[start][lang] = sortIndex
  //   return sortIndex
  // }

  queryResponses: Map<
    number,
    {
      persistent: Set<(x: any) => void>
      once: ((x: any) => void)[]
    }
  > = new Map()
  modResponses: Map<number, (x: any) => void> = new Map()

  addQueryListener(id: number, q: Uint8Array, cb: (x: any) => void) {
    if (!this.queryResponses.has(id)) {
      this.queryResponses.set(id, {
        persistent: new Set(),
        once: [],
      })
    }
    const s = this.queryResponses.get(id)
    s.persistent.add(cb)
  }

  removeQueryListener(id: number, cb: (x: any) => void) {
    if (!this.queryResponses.has(id)) {
      return
    }
    const s = this.queryResponses.get(id)
    s.persistent.delete(cb)
    if (s.persistent.size === 0 && s.once.length === 0) {
      this.queryResponses.delete(id)
    }
  }

  execQueryListeners(id: number, q: Uint8Array) {
    const s = this.queryResponses.get(id)
    if (!s) {
      return
    }
    for (const fn of s.once) {
      fn(q)
    }
    if (s.persistent.size === 0) {
      this.queryResponses.delete(id)
    } else {
      for (const fn of s.persistent) {
        fn(q)
      }
      s.once = []
    }
  }

  addQueryOnceListener(id: number, q: Uint8Array, cb: (x: any) => void) {
    if (!this.queryResponses.has(id)) {
      this.queryResponses.set(id, {
        persistent: new Set(),
        once: [],
      })
    }
    const s = this.queryResponses.get(id)
    s.once.push(cb)
  }

  getQueryBuf(buf): Promise<Uint8Array> {
    // do this check in ZIG - also add to dbCtx
    // const schemaChecksum = readUint64(buf, buf.byteLength - 8)
    // if (schemaChecksum !== this.schema?.hash) {
    //   return Promise.resolve(new Uint8Array(1))
    // }
    return new Promise((resolve) => {
      const id = readUint32(buf, 0)
      if (this.queryResponses.get(id)) {
        console.log('Query allready staged dont exec again')
      } else {
        native.getQueryBufThread(buf, this.dbCtxExternal)
      }
      this.addQueryOnceListener(id, buf, resolve)
    })
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
      return schema.hash
    }

    if (this.schema) {
      if (schema.hash === this.migrating) {
        await this.once('schema')
        return this.schema.hash
      }
      await migrate(this, this.schema, schema, transformFns)
      return this.schema.hash
    }

    setSchemaOnServer(this, schema)
    setNativeSchema(this, schema)
    await writeSchemaFile(this, schema)

    process.nextTick(() => {
      this.emit('schema', this.schema)
    })

    return schema.hash
  }

  addModifyListener(m: Uint8Array, cb: (x: any) => void) {
    // id will be at zero
    const id = readUint32(m, 0)
    this.modResponses.set(id, cb)
  }

  removeModifyListener(m: Uint8Array) {
    // id will be at zero
    const id = readUint32(m, 0)
    this.modResponses.delete(id)
  }

  modify(payload: Uint8Array): Uint8Array | null | Promise<Uint8Array | null> {
    const hash = readUint64(payload, 0)
    if (this.schema?.hash !== hash) {
      this.emit('info', 'Schema mismatch in write')
      return null
    }

    const content = payload.subarray(8)
    const len = native.modifyThread(content, this.dbCtxExternal)
    // the return value will not really work here...

    return content.subarray(0, len)
  }

  // #expire() {
  //   native.modifyThread(emptyUint8Array, this.dbCtxExternal)
  // }

  // getQueryBuf(buf: Uint8Array): Promise<Uint8Array> {
  //   if (this.stopped) {
  //     console.error('Db is stopped - trying to query', buf.byteLength)
  //     return Promise.resolve(new Uint8Array(8))
  //   }

  //   const queryType = buf[0]
  //   if (queryType == QueryType.default) {
  // // TODO: make a function for this!
  // const s = 14 + readUint16(buf, 11)
  // const sortLen = readUint16(buf, s)
  // if (sortLen) {
  //   // make function for this
  //   const typeId = readUint16(buf, 1)
  //   const sort = buf.slice(s + 2, s + 2 + sortLen)
  //   const field = sort[1]
  //   const start = readUint16(sort, 3)
  //   let sortIndex = this.getSortIndex(typeId, field, start, 0)
  //   if (!sortIndex) {
  //     if (this.activeReaders) {
  //       return new Promise((resolve) => {
  //         this.addToQueryQueue(resolve, buf)
  //       })
  //     }
  //     sortIndex = this.createSortIndexBuffer(
  //       typeId,
  //       field,
  //       start,
  //       sort[sort.byteLength - 1],
  //     )
  //   }
  //   // increment
  //   sortIndex.cnt++
  //   this.cleanup()
  // }
  //   } else if (queryType == 1) {
  //     // This will be more advanced - sometimes has indexes / sometimes not
  //   }

  //   // if (!fromQueue) {
  //   //   this.#expire()
  //   // }

  //   // return this.getQueryBuf(buf)
  // }

  async stop(noSave?: boolean) {
    if (this.stopped) {
      return
    }
    clearTimeout(this.subscriptions.updateHandler)
    this.subscriptions.updateHandler = null
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
      native.stop(this.dbCtxExternal)
      this.dbCtxExternal = null
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
