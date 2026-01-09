import native from '../native.js'
import { rm } from 'node:fs/promises'
import { start, StartOpts } from './start.js'
import { migrate } from './migrate/index.js'
import { debugServer } from '../utils/debug.js'
import { DbShared } from '../shared/DbBase.js'
import {
  setNativeSchema,
  setSchemaOnServer,
  writeSchemaFile,
} from './schema.js'
import { save, SaveOpts } from './blocks.js'

import { OpType, OpTypeEnum, OpTypeInverse } from '../zigTsExports.js'
import {
  MAX_ID,
  type SchemaMigrateFns,
  type SchemaOut,
} from '../schema/index.js'
import { readUint32, writeUint32 } from '../utils/uint8.js'

export class DbServer extends DbShared {
  dbCtxExternal: any // pointer to zig dbCtx

  migrating: number
  saveInProgress: boolean = false
  fileSystemPath: string
  activeReaders = 0 // processing queries or other DB reads
  modifyQueue: Map<Function, Uint8Array> = new Map()
  queryQueue: Map<Function, Uint8Array> = new Map()
  stopped: boolean // = true does not work
  saveIntervalInSeconds?: number
  saveInterval?: NodeJS.Timeout
  delayInMs?: number

  // hack to prevent gc to clean up a var
  forceRefCnt: number = 0
  keepRefAliveTillThisPoint(x: Uint8Array) {
    this.forceRefCnt = x.byteLength
  }

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
    const type = this.opListeners.get(op)!
    if (!type.has(id)) {
      type.set(id, {
        persistent: new Set(),
        once: [],
      })
    }
    const s = type.get(id)!
    s.persistent.add(cb)
  }

  addOpOnceListener(op: OpTypeEnum, id: number, cb: (q: Uint8Array) => void) {
    const type = this.opListeners.get(op)!
    if (!type.has(id)) {
      type.set(id, {
        persistent: new Set(),
        once: [],
      })
    }
    const s = type.get(id)!
    s.once.push(cb)
  }

  removeOpListener(op: OpTypeEnum, id: number, cb: (x: any) => void) {
    const type = this.opListeners.get(op)!
    const s = type.get(id)!
    s.persistent.delete(cb)
    if (s.persistent.size === 0 && s.once.length === 0) {
      type.delete(id)
    }
  }

  execOpListeners(op: OpTypeEnum, id: number, q: Uint8Array) {
    const type = this.opListeners.get(op)!
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

  getQueryBuf(buf: Uint8Array): Promise<Uint8Array> {
    return new Promise((resolve) => {
      const id = readUint32(buf, 0)
      const op: OpTypeEnum = buf[4] as OpTypeEnum

      // console.log('[Get q buf]', OpTypeInverse[op])

      const queryListeners = this.opListeners.get(op)!

      if (queryListeners.get(id)?.once.length) {
        console.log('💤 Query already staged dont exec again', id)
      } else {
        native.query(buf, this.dbCtxExternal)
      }
      this.addOpOnceListener(op, id, resolve)
    })
  }

  unsubscribe(id: number) {}

  subscribe(buf: Uint8Array, onData: (d: Uint8Array) => void): number {
    const subSize = readUint32(buf, 0)
    const query = buf.subarray(subSize, buf.byteLength)

    const id = readUint32(query, 0)
    const op: OpTypeEnum = query[4] as OpTypeEnum
    const queryListeners = this.opListeners.get(op)!

    console.log('derX???????????', id, OpTypeInverse[op])

    const qIdListeners = queryListeners.get(id)
    if (qIdListeners) {
      console.log('💤 Subscription already staged dont exec again', id)
    } else {
      native.query(query, this.dbCtxExternal)
    }

    if (!qIdListeners?.persistent.size) {
      console.log('DERP')
      native.modify(buf, this.dbCtxExternal)
    }

    this.addOpListener(op, id, onData)

    return id
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
      native.modify(payload, this.dbCtxExternal)
      this.addOpOnceListener(OpType.modify, id, (v) => {
        const resultLen = readUint32(v, 0)
        resolve(v.subarray(4, resultLen))
      })
    })
  }

  async setSchema(
    schema: SchemaOut,
    transformFns?: SchemaMigrateFns,
  ): Promise<SchemaOut['hash']> {
    if (this.stopped || !this.dbCtxExternal) {
      throw new Error('Db is stopped')
    }

    if (schema.hash === this.schema?.hash) {
      return schema.hash
    }

    if (this.schema) {
      console.log('MIGRATE NOT HERE YET')
      if (schema.hash === this.migrating) {
        await this.once('schema')
        return this.schema.hash
      }
      await migrate(this, this.schema, schema, transformFns)
      return this.schema.hash
    }

    setSchemaOnServer(this, schema)
    await setNativeSchema(this, schema)
    await writeSchemaFile(this, schema)

    process.nextTick(() => {
      this.emit('schema', this.schema!)
    })

    return schema.hash
  }

  async stop(noSave?: boolean) {
    if (this.stopped) {
      return
    }
    this.stopped = true

    if (this.saveInterval) {
      clearInterval(this.saveInterval)
      this.saveInterval = undefined
    }

    try {
      if (!noSave) {
        await save(this)
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
