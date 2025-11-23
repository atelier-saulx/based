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
import { combineToNumber, readUint32, wait, writeUint32 } from '@based/utils'
import { DbShared } from '../shared/DbBase.js'
import {
  setNativeSchema,
  setSchemaOnServer,
  writeSchemaFile,
} from './schema.js'
import { loadBlock, save, SaveOpts, unloadBlock } from './blocks.js'
import { Subscriptions } from './subscription.js'
import { OpType, OpTypeEnum } from '../zigTsExports.js'

// YOUZI REPLACE
const TMP_EMPTY = new Uint8Array(1000000)

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

    // Add all op type maps
    for (const key in OpType) {
      this.opListeners.set(OpType[key], new Map())
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

  // op listeners
  opListeners: Map<
    OpTypeEnum,
    Map<
      number,
      {
        persistent: Set<(x: any) => void>
        once: ((x: any) => void)[]
      }
    >
  > = new Map()

  addOpListener(op: OpTypeEnum, id: number, cb: (x: any) => void) {
    const type = this.opListeners.get(op)
    if (!type.has(id)) {
      type.set(id, {
        persistent: new Set(),
        once: [],
      })
    }
    const s = type.get(id)
    s.persistent.add(cb)
  }

  addOpOnceListener(op: OpTypeEnum, id: number, cb: (q: Uint8Array) => void) {
    const type = this.opListeners.get(op)
    if (!type.has(id)) {
      type.set(id, {
        persistent: new Set(),
        once: [],
      })
    }
    const s = type.get(id)
    s.once.push(cb)
  }

  removeOpListener(op: OpTypeEnum, id: number, cb: (x: any) => void) {
    const type = this.opListeners.get(op)
    const s = type.get(id)
    s.persistent.delete(cb)
    if (s.persistent.size === 0 && s.once.length === 0) {
      type.delete(id)
    }
  }

  execOpListeners(op: OpTypeEnum, id: number, q: Uint8Array) {
    const type = this.opListeners.get(op)
    const s = type.get(id)
    if (!s) {
      return
    }
    for (const fn of s.once) {
      fn(q)
    }
    if (s.persistent.size === 0) {
      type.delete(id)
    } else {
      for (const fn of s.persistent) {
        fn(q)
      }
      s.once = []
    }
  }

  getQueryBuf(buf): Promise<Uint8Array> {
    return new Promise((resolve) => {
      const id = readUint32(buf, 0)
      const op: OpTypeEnum = buf[4]
      const queryListeners = this.opListeners.get(op)
      if (queryListeners.get(id)) {
        console.log('💤 Query allready staged dont exec again', id)
      } else {
        native.getQueryBufThread(buf, this.dbCtxExternal)
      }
      this.addOpOnceListener(op, id, resolve)
    })
  }

  // allow 10 ids for special listeners on mod thread
  modifyCnt = 10

  modify(payload: Uint8Array): Promise<Uint8Array | null> {
    this.modifyCnt++
    if (this.modifyCnt > MAX_ID) {
      this.modifyCnt = 10
    }
    const id = this.modifyCnt++
    writeUint32(payload, id, 0)
    return new Promise((resolve) => {
      native.modifyThread(payload, this.dbCtxExternal)
      this.addOpOnceListener(OpType.modify, id, (v) => {
        const resultLen = readUint32(v, 0)
        const blocksLen = readUint32(v, resultLen)
        if (blocksLen > 8) {
          const blocksOffset = resultLen + 8 - (resultLen % 8) // ceil to multiple of 8
          this.blockMap.setDirtyBlocks(
            new Float64Array(v.buffer, blocksOffset, blocksLen / 8),
          )
        }
        // YOUZI
        const res = v.subarray(4, resultLen)
        console.log({ resultLen, res })
        resolve(res)
      })
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

    console.warn('WAITING 500MS AFTER SCHEMA FOR FIXFIX')
    await wait(500)
    process.nextTick(() => {
      this.emit('schema', this.schema)
    })

    return schema.hash
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
