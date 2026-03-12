import native from '../native.js'
import { cp, mkdir, readdir, rename, rm } from 'node:fs/promises'
import { realStart, start, StartOpts } from './start.js'
import { DbShared } from '../shared/DbBase.js'
import { writeSchemaFile } from './schema.js'
import { save, SaveOpts } from './blocks.js'

import { OpType, OpTypeEnum } from '../zigTsExports.js'
import { MAX_ID, type SchemaOut } from '../schema/index.js'
import { readUint32, writeUint32 } from '../utils/uint8.js'
import { getTypeDefs } from '../schema/defs/getTypeDefs.js'
import { join } from 'node:path'
import hashObjectIgnoreKeyOrder from '../hash/hashObjectIgnoreKeyOrder.js'
import deepEqual from '../utils/deepEqual.js'

type DbServerOpts = {
  path: string
  saveIntervalInSeconds?: number
}

// this will become db server
export class DbServerWrapper extends DbShared {
  constructor(opts: DbServerOpts) {
    super()
    this.ctx = new DbServer(opts)
  }
  ctx: DbServer
  start(opts?: StartOpts) {
    return this.ctx.start(opts)
  }
  save(opts?: SaveOpts) {
    return this.ctx.save(opts)
  }
  getQueryBuf(buf: Uint8Array) {
    return this.ctx.getQueryBuf(buf)
  }
  subscribe(buf: Uint8Array, onData: (d: Uint8Array) => void) {
    return this.ctx.subscribe(buf, onData)
  }
  unsubscribe(op: OpTypeEnum, id: number, onData: (d: Uint8Array) => void) {
    return this.ctx.unsubscribe(op, id, onData)
  }
  modify(buf: Uint8Array) {
    return this.ctx.modify(buf)
  }
  async setSchema(schema: SchemaOut) {
    console.log('set schema!', JSON.stringify(schema, null, 2))
    if (!this.ctx.schema) {
      return this.ctx.setSchema(schema)
    }
    if (schema.hash === this.ctx.schema.hash) {
      return schema.hash
    }
    console.log('migration time!', schema.hash, this.ctx.schema.hash)
    const path = this.ctx.fileSystemPath

    const typeDefs1 = getTypeDefs(this.ctx.schema)
    const typeDefs2 = getTypeDefs(schema)

    const tmpPath = join(path, 'tmp')
    const newCtx = new DbServer({ path: tmpPath })
    const files = await readdir(path)
    await rm(tmpPath, { recursive: true, force: true })
    await mkdir(tmpPath, { recursive: true })
    await Promise.all(
      typeDefs2.values().map((def) => {
        const prevDef = typeDefs1.get(def.name)
        if (prevDef && deepEqual(def.schema, prevDef.schema)) {
          console.log('compatible schema:', def.name, def.schema)
          return Promise.all(
            files.map((file) => {
              const split = file.split('_')
              if (Number(split[0]) === prevDef.id) {
                split[0] = String(def.id)
                return rename(join(path, file), join(tmpPath, split.join('_')))
              }
            }),
          )
        } else {
          console.log(
            'incompatible schema:',
            def.name,
            JSON.stringify(def.schema, null, 2),
            JSON.stringify(prevDef?.schema, null, 2),
          )
        }
      }),
    )
    console.log('power hour')
    realStart(newCtx, schema)
    console.log('yas')
    return schema.hash
  }
  override on() {
    return this.ctx.on.apply(this.ctx, arguments)
  }
  override off() {
    return this.ctx.off.apply(this.ctx, arguments)
  }
  stop(noSave?: boolean) {
    return this.ctx.stop(noSave)
  }
  destroy() {
    return this.ctx.destroy()
  }
  // tmp
  keepRefAliveTillThisPoint(x) {
    return this.ctx.keepRefAliveTillThisPoint(x)
  }
}

export class DbServer extends DbShared {
  dbCtxExternal: any // pointer to zig dbCtx

  migrating!: number
  saveInProgress: boolean = false
  fileSystemPath: string
  // activeReaders = 0 // processing queries or other DB reads
  // modifyQueue: Map<Function, Uint8Array> = new Map()
  // queryQueue: Map<Function, Uint8Array> = new Map()
  stopped!: boolean // = true does not work
  saveIntervalInSeconds?: number
  saveInterval?: NodeJS.Timeout
  delayInMs?: number

  // hack to prevent gc to clean up a var
  forceRefCnt: number = 0
  keepRefAliveTillThisPoint(x: Uint8Array) {
    this.forceRefCnt = x.byteLength
  }

  constructor({ path, saveIntervalInSeconds }: DbServerOpts) {
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
      const queryListeners = this.opListeners.get(op)!
      const onceListeners = !!queryListeners.get(id)?.once.length
      this.addOpOnceListener(op, id, resolve)

      if (onceListeners) {
        console.log('💤 Query already staged dont exec again', id)
      } else {
        native.query(buf, this.dbCtxExternal)
      }
    })
  }

  unsubscribe(
    op: OpTypeEnum,
    id: number,
    onData: (d: Uint8Array) => void,
  ): void {
    // TODO!!
    this.removeOpListener(op, id, onData)
  }

  subscribe(buf: Uint8Array, onData: (d: Uint8Array) => void): void {
    const subSize = readUint32(buf, 0)
    const query = buf.subarray(subSize)
    const id = readUint32(query, 0)
    const op = query[4] as OpTypeEnum
    const queryListeners = this.opListeners.get(op)!
    const qIdListeners = queryListeners.get(id)
    if (!qIdListeners?.persistent.size) {
      native.modify(buf, this.dbCtxExternal)
    }
    this.addOpListener(op, id, onData)
    if (qIdListeners) {
      console.log('💤 Subscription already staged dont exec again', id)
    } else {
      native.query(query, this.dbCtxExternal)
    }
  }

  // allow 10 ids for special listeners on mod thread
  modifyCnt = 10

  modify(payload: Uint8Array): Promise<Uint8Array> {
    this.modifyCnt++
    if (this.modifyCnt > MAX_ID) {
      this.modifyCnt = 10
    }
    const id = this.modifyCnt++
    writeUint32(payload, id, 0)
    payload[4] = OpType.modify
    return new Promise((resolve) => {
      native.modify(payload, this.dbCtxExternal)
      this.addOpOnceListener(OpType.modify, id, (v) => {
        const end = readUint32(v, 0)
        resolve(v.subarray(4, end))
      })
    })
  }

  async setSchema(
    schema: SchemaOut, //,
    // transformFns?: SchemaMigrateFns,
  ): Promise<SchemaOut['hash']> {
    if (this.stopped) throw new Error('Db is stopped')
    if (schema.hash === this.schema?.hash) return schema.hash
    if (this.schema) {
      console.log('MIGRATE NOT HERE YET')
      if (schema.hash === this.migrating) {
        await this.once('schema')
        return this.schema.hash
      }
      // start blocking modifies
      // save dump
      // load dump in new DbServer
      // migrate in place

      // await migrate(this, this.schema, schema, transformFns)
      return this.schema.hash
    }
    console.log('do it!')
    if (this.dbCtxExternal) throw new Error('Db is already running')
    realStart(this, schema)
    await writeSchemaFile(this, schema)
    process.nextTick(() => this.emit('schema', this.schema!))
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
      if (!noSave) await save(this)
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

// mod ping?
