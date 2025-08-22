import { MigrateFns, parse, Schema, StrictSchema } from '@based/schema'
import { create, CreateObj } from './modify/create.js'
import {
  flushBuffer,
  makeFlushIsReady,
  ModifyCtx,
  startDrain,
} from './flushModify.js'
import { BasedDbQuery, QueryByAliasObj } from './query/BasedDbQuery.js'
import { ModifyRes, ModifyState } from './modify/ModifyRes.js'
import { upsert } from './modify/upsert.js'
import { update } from './modify/update.js'
import { deleteFn } from './modify/delete.js'
import { ModifyOpts } from './modify/types.js'
import { expire } from './modify/expire.js'
import { debugMode } from '../utils.js'
import { SubStore } from './query/subscription/index.js'
import { DbShared } from '../shared/DbBase.js'
import { DbClientHooks } from '../hooks.js'
import { setLocalClientSchema } from './setLocalClientSchema.js'
import { SchemaChecksum } from '../schema.js'

type DbClientOpts = {
  hooks: DbClientHooks
  maxModifySize?: number
  flushTime?: number
  debug?: boolean
}

export class DbClient extends DbShared {
  constructor({
    hooks,
    maxModifySize = 100 * 1e3 * 1e3,
    flushTime = 0,
    debug,
  }: DbClientOpts) {
    super()
    this.hooks = hooks
    this.maxModifySize = maxModifySize
    this.modifyCtx = new ModifyCtx(this)
    this.flushTime = flushTime
    makeFlushIsReady(this)
    if (debug) {
      debugMode(this)
    }
    this.hooks.subscribeSchema((schema) => {
      setLocalClientSchema(this, schema)
    })
  }

  subs = new Map<BasedDbQuery, SubStore>()

  hooks: DbClientHooks

  // modify
  flushTime: number
  flushReady: () => void
  flushIsReady: Promise<void>

  writeTime: number = 0
  isDraining = false
  modifyCtx: ModifyCtx
  maxModifySize: number
  upserting: Map<
    number,
    { o: Record<string, any>; p: Promise<number | ModifyRes> }
  > = new Map()

  async schemaIsSet() {
    if (!this.schema) {
      await this.once('schema')
    }
  }

  async setSchema(
    schema: Schema,
    transformFns?: MigrateFns,
  ): Promise<SchemaChecksum> {
    const strictSchema = parse(schema).schema
    await this.drain()
    const schemaChecksum = await this.hooks.setSchema(
      strictSchema as StrictSchema,
      transformFns,
    )
    if (schemaChecksum !== this.schema?.hash) {
      await this.once('schema')
      return this.schema.hash
    }
    return schemaChecksum
  }

  create(type: string, obj: CreateObj = {}, opts?: ModifyOpts): ModifyRes {
    return create(this, type, obj, opts)
  }

  async copy(
    type: string,
    target: number | ModifyRes,
    objOrTransformFn?:
      | Record<string, any>
      | ((item: Record<string, any>) => Promise<any>),
  ): Promise<ModifyRes> {
    const item = await this.query(type, target)
      .include('*', '**.id')
      .get()
      .toObject()

    if (typeof objOrTransformFn === 'function') {
      const { id: _, ...props } = await objOrTransformFn(item)
      return this.create(type, props)
    }

    if (typeof objOrTransformFn === 'object' && objOrTransformFn !== null) {
      const { id: _, ...props } = item
      await Promise.all(
        Object.keys(objOrTransformFn).map(async (key) => {
          const val = objOrTransformFn[key]
          if (val === null) {
            delete props[key]
          } else if (typeof val === 'function') {
            const res = await val(item)
            if (Array.isArray(res)) {
              props[key] = await Promise.all(res)
            } else {
              props[key] = res
            }
          } else {
            props[key] = val
          }
        }),
      )
      return this.create(type, props)
    }

    const { id: _, ...props } = item
    return this.create(type, props)
  }

  query(
    type: string,
    id?:
      | number
      | ModifyRes
      | (number | ModifyRes)[]
      | QueryByAliasObj
      | QueryByAliasObj[]
      | Uint32Array,
  ): BasedDbQuery

  query(): BasedDbQuery

  query(
    type?: string,
    id?:
      | number
      | ModifyRes
      | (number | ModifyRes)[]
      | QueryByAliasObj
      | QueryByAliasObj[]
      | Uint32Array
      | { [alias: string]: string }, // alias
  ): BasedDbQuery {
    if (type === undefined) {
      return new BasedDbQuery(this, '_root', 1)
    }

    // this is now double resolve
    if (Array.isArray(id)) {
      let i = id.length
      while (i--) {
        if (typeof id[i] === 'object') {
          if (id[i] instanceof ModifyState) {
            // @ts-ignore
            id[i] = id[i].tmpId
          } else {
            // it's get by alias
          }
        }
      }
    } else if (id instanceof Uint32Array) {
      // all good
    } else if (typeof id === 'object') {
      if (id instanceof ModifyState) {
        id = id.tmpId
      } else {
        // it's get by alias
      }
    }

    return new BasedDbQuery(this, type, id as number | number[] | Uint32Array)
  }

  update(
    type: string,
    id: number | ModifyRes,
    value: any,
    opts?: ModifyOpts,
  ): ModifyRes

  update(
    type: string,
    value: Record<string, any> & { id: number | ModifyRes },
    opts?: ModifyOpts,
  ): ModifyRes

  update(value: Record<string, any>, opts?: ModifyOpts): ModifyRes

  update(
    typeOrValue: string | any,
    idOverwriteOrValue:
      | number
      | ModifyRes
      | boolean
      | ModifyOpts
      | (Record<string, any> & { id: number | ModifyRes }),
    value?: any,
    opts?: ModifyOpts,
  ): ModifyRes {
    if (typeof typeOrValue === 'string') {
      if (typeof idOverwriteOrValue === 'object') {
        if (idOverwriteOrValue instanceof ModifyState) {
          return update(
            this,
            typeOrValue,
            idOverwriteOrValue.tmpId,
            value,
            opts,
          )
        }
        if ('id' in idOverwriteOrValue) {
          const { id, ...props } = idOverwriteOrValue
          return this.update(typeOrValue, id, props, opts)
        }
      }
      return update(
        this,
        typeOrValue,
        idOverwriteOrValue as number,
        value,
        opts,
      )
    }
    // else it is rootProps
    return update(
      this,
      '_root',
      1,
      typeOrValue,
      idOverwriteOrValue as ModifyOpts,
    )
  }

  upsert(type: string, obj: Record<string, any>, opts?: ModifyOpts) {
    return upsert(this, type, obj, opts)
  }

  delete(type: string, id: number | ModifyRes) {
    return deleteFn(this, type, typeof id === 'number' ? id : id.tmpId)
  }

  expire(type: string, id: number | ModifyRes, seconds: number) {
    return expire(this, type, typeof id === 'number' ? id : id.tmpId, seconds)
  }

  destroy() {
    this.stop()
    delete this.listeners
    this.modifyCtx.db = null // Make sure we don't have a circular ref and leak mem
  }

  stop() {
    for (const [, { onClose }] of this.subs) {
      onClose()
    }
    this.subs.clear()
    this.modifyCtx.len = 0
  }

  // For more advanced / internal usage - use isModified instead for most cases
  async drain() {
    if (this.upserting.size) {
      await Promise.all(Array.from(this.upserting).map(([, { p }]) => p))
    }
    await flushBuffer(this)
    const t = this.writeTime
    this.writeTime = 0
    return t
  }

  async isModified() {
    if (!this.isDraining) {
      startDrain(this)
    }
    await this.flushIsReady
    return
  }
}
