import {
  MigrateFns,
  parse,
  Schema,
  StrictSchema,
  SchemaChecksum,
} from '@based/schema'
import { BasedDbQuery, QueryByAliasObj } from './query/BasedDbQuery.js'
import { debugMode } from '../utils.js'
import { SubStore } from './query/subscription/index.js'
import { DbShared } from '../shared/DbBase.js'
import { DbClientHooks } from '../hooks.js'
import { setLocalClientSchema } from './setLocalClientSchema.js'
import { ModifyOpts } from './modify/types.js'
import { create } from './modify/create/index.js'
import { Ctx } from './modify/Ctx.js'
import { update } from './modify/update/index.js'
import { del } from './modify/delete/index.js'
import { expire } from './modify/expire/index.js'
import { cancel, consume, drain, schedule } from './modify/drain.js'
import { upsert } from './modify/upsert/index.js'

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
    this.modifyCtx = new Ctx(
      0,
      new Uint8Array(
        new ArrayBuffer(Math.min(1e3, maxModifySize), {
          maxByteLength: maxModifySize,
        }),
      ),
    )
    this.flushTime = flushTime

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
  writeTime: number = 0
  isDraining = false
  modifyCtx: Ctx
  maxModifySize: number
  upserting: Map<number, { o: Record<string, any>; p: Promise<number> }> =
    new Map()

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

  create(type: string, obj = {}, opts?: ModifyOpts): Promise<number> {
    return create(this, type, obj, opts)
  }

  async copy(
    type: string,
    target: number,
    objOrTransformFn?:
      | Record<string, any>
      | ((item: Record<string, any>) => Promise<any>),
  ): Promise<number> {
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
      | Promise<number>
      | (number | Promise<number>)[]
      | QueryByAliasObj
      | QueryByAliasObj[]
      | Uint32Array,
  ): BasedDbQuery

  query(): BasedDbQuery

  query(
    type?: string,
    id?:
      | number
      | number[]
      | QueryByAliasObj
      | QueryByAliasObj[]
      | Uint32Array
      | { [alias: string]: string }, // alias
  ): BasedDbQuery {
    if (type === undefined) {
      return new BasedDbQuery(this, '_root', 1)
    }

    return new BasedDbQuery(this, type, id as number | number[] | Uint32Array)
  }

  update(
    type: string,
    id: number | Promise<number>,
    value: any,
    opts?: ModifyOpts,
  ): Promise<number>

  update(
    type: string,
    value: Record<string, any> & { id: number },
    opts?: ModifyOpts,
  ): Promise<number>

  update(value: Record<string, any>, opts?: ModifyOpts): Promise<number>

  update(
    typeOrValue: string | any,
    idOverwriteOrValue:
      | number
      | Promise<number>
      | boolean
      | ModifyOpts
      | (Record<string, any> & { id: number }),
    value?: any,
    opts?: ModifyOpts,
  ): Promise<number> {
    if (typeof typeOrValue !== 'string') {
      return this.update(
        '_root',
        1,
        typeOrValue,
        idOverwriteOrValue as ModifyOpts,
      )
    }
    if (typeof idOverwriteOrValue === 'object') {
      if (
        'then' in idOverwriteOrValue &&
        typeof idOverwriteOrValue.then === 'function'
      ) {
        // @ts-ignore
        if (idOverwriteOrValue.id) {
          // @ts-ignore
          return this.update(typeOrValue, idOverwriteOrValue.id, value, opts)
        }
        return idOverwriteOrValue.then((id: number) => {
          return this.update(typeOrValue, id, value, opts)
        })
      }
      if ('id' in idOverwriteOrValue) {
        const { id, ...props } = idOverwriteOrValue
        return this.update(typeOrValue, id, props, opts)
      }
    }
    return update(this, typeOrValue, idOverwriteOrValue as number, value, opts)
  }

  upsert(type: string, obj: Record<string, any>, opts?: ModifyOpts) {
    return upsert(this, type, obj, opts)
  }

  delete(type: string, id: number | Promise<number>) {
    if (
      typeof id === 'object' &&
      id !== null &&
      'then' in id &&
      typeof id.then === 'function'
    ) {
      // @ts-ignore
      if (id.id) {
        // @ts-ignore
        id = id.id
      } else {
        return id.then((id) => this.delete(type, id))
      }
    }
    // @ts-ignore
    return del(this, type, id)
  }

  expire(type: string, id: number, seconds: number) {
    return expire(this, type, id, seconds)
  }

  destroy() {
    this.stop()
    delete this.listeners
  }

  stop() {
    for (const [, { onClose }] of this.subs) {
      onClose()
    }
    this.subs.clear()
    cancel(this.modifyCtx, Error('Db stopped - in-flight modify cancelled'))
  }

  // For more advanced / internal usage - use isModified instead for most cases
  async drain() {
    if (this.upserting.size) {
      await Promise.all(Array.from(this.upserting).map(([, { p }]) => p))
    }
    await drain(this, this.modifyCtx)
    const t = this.writeTime
    this.writeTime = 0
    return t
  }

  isModified() {
    return schedule(this, this.modifyCtx)
  }
}
