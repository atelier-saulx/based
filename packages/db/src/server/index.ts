import native from '../native.js'
import { rm } from 'node:fs/promises'
import {
  StrictSchema,
  MigrateFns,
  SchemaChecksum,
  strictSchemaToDbSchema,
  MAX_ID,
} from '@based/schema'
import { start, StartOpts } from './start.js'
import {
  BlockMap,
  destructureTreeKey,
  makeTreeKeyFromNodeId,
} from './blockMap.js'
import { migrate } from './migrate/index.js'
import exitHook from 'exit-hook'
import { debugServer } from '../utils.js'
import { combineToNumber, readUint32, writeUint32 } from '@based/utils'
import { DbShared } from '../shared/DbBase.js'
import {
  setNativeSchema,
  setSchemaOnServer,
  writeSchemaFile,
} from './schema.js'
import { loadBlock, save, SaveOpts, unloadBlock } from './blocks.js'
import { Subscriptions } from './subscription.js'

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

  queryResponses: Map<
    number,
    {
      persistent: Set<(x: any) => void>
      once: ((x: any) => void)[]
    }
  > = new Map()
  modResponses: Map<number, (x: any) => void> = new Map()

  addQueryListener(id: number, cb: (x: any) => void) {
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

  execQueryListeners(id: number, type: number, q: Uint8Array) {
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
      // make readUint40 ?
      const id = combineToNumber(readUint32(buf, 0), buf[4])
      console.log('????', id, readUint32(buf, 0))
      if (this.queryResponses.get(id)) {
        console.log('Query allready staged dont exec again', id)
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

  // allow 10 ids for special listeners on mod thread
  modifyCnt = 10

  addModifyListener(id: number, cb: (x: any) => void) {
    this.modResponses.set(id, cb)
  }

  removeModifyListener(id: number) {
    this.modResponses.delete(id)
  }

  execModifyListeners(id: number, type: number, v: Uint8Array) {
    const fn = this.modResponses.get(id)
    if (!fn) {
      return
    }
    try {
      const dirtyBlockSize = readUint32(v, 0)
      if (dirtyBlockSize > 8) {
        const dirtyBlocks = new Float64Array(
          v.buffer,
          v.byteOffset + 7,
          (v.byteLength - 7) / 8,
        )
        this.blockMap.setDirtyBlocks(dirtyBlocks)
      }
      fn(v.subarray(dirtyBlockSize))
    } catch (err) {
      console.error(err)
    }
  }

  modify(payload: Uint8Array): Promise<Uint8Array | null> {
    this.modifyCnt++
    if (this.modifyCnt > MAX_ID) {
      this.modifyCnt = 10
    }
    const id = this.modifyCnt++
    writeUint32(payload, id, 0)
    return new Promise((resolve) => {
      const len = native.modifyThread(payload, this.dbCtxExternal)
      this.addModifyListener(id, (v) => {
        this.removeModifyListener(id)
        resolve(v)
      })
    })
  }

  async stop(noSave?: boolean) {
    if (this.stopped) {
      return
    }
    clearTimeout(this.subscriptions.updateHandler)
    this.subscriptions.updateHandler = null
    this.stopped = true
    this.unlistenExit()

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
