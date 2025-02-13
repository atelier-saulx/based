import { parse, Schema, StrictSchema } from '@based/schema'
import { create, CreateObj } from './modify/create.js'
import { SchemaTypeDef } from '../server/schema/types.js'
import { flushBuffer, ModifyCtx } from './operations.js'
import {
  SubscriptionMarkerMap,
  SubscriptionsMap,
  SubscriptionsToRun,
} from './query/subscription/index.js'
import { BasedDbQuery, QueryByAliasObj } from './query/BasedDbQuery.js'
import { ModifyRes, ModifyState } from './modify/ModifyRes.js'
import { upsert } from './modify/upsert.js'
import { update } from './modify/update.js'
import { remove } from './modify/remove.js'
import { updateTypeDefs } from '../server/schema/typeDef.js'
import { DbServer } from '../server/index.js'
import { schemaToSelvaBuffer } from '../server/schema/selvaBuffer.js'
import { deepEqual } from '@saulx/utils'
import { TransformFns } from '../server/migrate/index.js'
import { hash } from '@saulx/hash'
import { ModifyOpts } from './modify/types.js'

export type DbClientHooks = {
  putSchema(
    schema: StrictSchema,
    fromStart?: boolean,
    transformFns?: TransformFns,
  ): Promise<DbServer['schema']>
  flushModify(buf: Buffer): Promise<{
    offsets: Record<number, number>
  }>
  getQueryBuf(buf: Buffer): Promise<Uint8Array>
}

type DbClientOpts = {
  hooks: DbClientHooks
  maxModifySize?: number
}

export class DbClient {
  constructor({ hooks, maxModifySize = 100 * 1e3 * 1e3 }: DbClientOpts) {
    this.hooks = hooks
    this.maxModifySize = maxModifySize
    this.modifyCtx = new ModifyCtx(this)
  }

  hooks: DbClientHooks

  // schema
  schema: StrictSchema & { lastId: number } = {
    lastId: 1, // we reserve one for root props
    types: {},
  }

  schemaTypesParsed: Record<string, SchemaTypeDef> = {}
  schemaTypesParsedById: Record<number, SchemaTypeDef> = {}

  // modify
  writeTime: number = 0
  isDraining = false
  modifyCtx: ModifyCtx
  maxModifySize: number
  upserting: Map<
    string,
    { o: Record<string, any>; p: Promise<number | ModifyRes> }
  > = new Map()

  // subscriptions
  subscriptionsInProgress: boolean = false
  subscriptonThrottleMs: number = 20
  subscriptions: SubscriptionsMap = new Map()
  subscriptionMarkers: SubscriptionMarkerMap = {}
  subscriptionsToRun: SubscriptionsToRun = []
  schemaChecksum: number

  async putSchema(
    schema: Schema,
    fromStart?: boolean,
    transformFns?: TransformFns,
  ): Promise<StrictSchema> {
    const checksum = hash(schema)
    if (checksum === this.schemaChecksum) {
      return this.schema
    }
    const strictSchema = fromStart ? schema : parse(schema).schema
    const remoteSchema = await this.hooks.putSchema(
      strictSchema as StrictSchema,
      fromStart,
      transformFns,
    )
    this.schemaChecksum = checksum
    return this.putLocalSchema(remoteSchema)
  }

  putLocalSchema(schema) {
    if (deepEqual(this.schema, schema)) {
      return this.schema
    }
    this.schema = schema
    updateTypeDefs(this)
    // TODO should not need this, but it modifies the schema
    schemaToSelvaBuffer(this.schemaTypesParsed)
    return this.schema
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
      const { id, ...props } = await objOrTransformFn(item)
      return this.create(type, props)
    }

    if (typeof objOrTransformFn === 'object' && objOrTransformFn !== null) {
      const { id, ...props } = item
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

    const { id, ...props } = item
    return this.create(type, props)
  }

  query(
    type: string,
    id?:
      | number
      | ModifyRes
      | (number | ModifyRes)[]
      | QueryByAliasObj
      | QueryByAliasObj[],
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
    } else if (typeof id === 'object') {
      if (id instanceof ModifyState) {
        id = id.tmpId
      } else {
        // it's get by alias
      }
    }

    return new BasedDbQuery(this, type, id as number | number[])
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

  update(value: any, opts?: ModifyOpts): ModifyRes

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

  remove(type: string, id: number | ModifyRes) {
    return remove(this, type, typeof id === 'number' ? id : id.tmpId)
  }

  destroy() {
    this.modifyCtx.len = 0
    this.modifyCtx.db = null // Make sure we don't have a circular ref and leak mem
  }

  stop() {
    this.modifyCtx.len = 0
  }

  async drain() {
    await flushBuffer(this)
    const t = this.writeTime
    this.writeTime = 0
    return t
  }
}
