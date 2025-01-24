import { ModifyRes, ModifyState } from './client/modify/ModifyRes.js'
import { Schema, StrictSchema } from '@based/schema'
import { ALIAS, SchemaTypeDef } from './server/schema/schema.js'
import { BasedDbQuery } from './client/query/BasedDbQuery.js'
import { ModifyCtx, flushBuffer } from './client/operations.js'
import { create, remove, update } from './client/modify/index.js'
import { compress, decompress } from './client/string.js'
import { DbServer } from './server/index.js'
import { QueryByAliasObj } from './client/query/types.js'
import {
  SubscriptionsMap,
  ModifySubscriptionMap,
  SubscriptionsToRun,
} from './client/query/subscription/index.js'
import { DbClient } from './client/index.js'

export * from './server/schema/typeDef.js'
export * from './client/modify/modify.js'

export { compress, decompress }
export { ModifyCtx } // TODO move this somewhere

export class BasedDb {
  client: DbClient
  server: DbServer
  fileSystemPath: string
  maxModifySize: number
  constructor({
    path,
    maxModifySize,
    noCompression,
  }: {
    path: string
    maxModifySize?: number
    noCompression?: boolean
  }) {
    this.server = new DbServer({
      path,
      maxModifySize: maxModifySize,
    })
    this.client = new DbClient({
      hooks: {
        putSchema: async (schema, fromStart) => {
          return this.server.putSchema(schema, fromStart)
        },
        flushModify: async (buf) => {
          this.server.modify(buf)
          return { offset: 0 }
        },
        getQueryBuf: async (buf) => {
          return this.server.getQueryBuf(buf)
        },
      },
    })
  }

  // client
  create: DbClient['create'] = function () {
    return this.client.create.apply(this.client, arguments)
  }

  update: DbClient['update'] = function () {
    return this.client.update.apply(this.client, arguments)
  }

  upsert: DbClient['upsert'] = function () {
    return this.client.upsert.apply(this.client, arguments)
  }

  remove: DbClient['remove'] = function () {
    return this.client.remove.apply(this.client, arguments)
  }

  query: DbClient['query'] = function () {
    return this.client.query.apply(this.client, arguments)
  }

  putSchema: DbClient['putSchema'] = function () {
    return this.client.putSchema.apply(this.client, arguments)
  }

  drain: DbClient['drain'] = function () {
    return this.client.drain.apply(this.client, arguments)
  }

  // server
  start: DbServer['start'] = function () {
    return this.server.start.apply(this.server, arguments)
  }

  stop: DbServer['stop'] = function () {
    this.client.stop()
    return this.server.stop.apply(this.server, arguments)
  }

  save: DbServer['save'] = function () {
    return this.server.save.apply(this.server, arguments)
  }

  migrateSchema: DbServer['migrateSchema'] = function () {
    return this.server.migrateSchema.apply(this.server, arguments)
  }

  // both
  destroy() {
    this.client.destroy()
    return this.server.destroy()
  }
}
/*
export class _BasedDb {
  isDraining: boolean = false
  maxModifySize: number = 100 * 1e3 * 1e3
  modifyCtx: ModifyCtx
  server: DbServer
  id: number
  // total write time until .drain is called manualy
  writeTime: number = 0
  fileSystemPath: string
  noCompression: boolean
  schemaTypesParsed: {
    [key: string]: SchemaTypeDef
  }

  subscriptionsInProgress: boolean = false

  subscriptonThrottleMs: number = 20

  subscriptions: SubscriptionsMap = new Map()
  modifySubscriptions: ModifySubscriptionMap = new Map()
  subscriptionsToRun: SubscriptionsToRun = []

  constructor({
    path,
    maxModifySize,
    noCompression,
    // hooks,
  }: {
    path: string
    maxModifySize?: number
    noCompression?: boolean
    // hooks?: Hooks
  }) {
    if (maxModifySize) {
      this.maxModifySize = maxModifySize
    }
    this.modifyCtx = new ModifyCtx(this)
    this.noCompression = noCompression || false
    this.fileSystemPath = path
    this.server = new DbServer({
      path: this.fileSystemPath,
      maxModifySize: this.maxModifySize,
    })
    this.schemaTypesParsed = this.server.schemaTypesParsed
  }

  async start(opts: { clean?: boolean; dbCtxExternal?: any } = {}): Promise<
    {
      shard: number
      field: number
      entries: number
      type: number[]
      lastId: number
    }[]
  > {
    await this.server.start(opts)
    return []
  }

  migrateSchema(
    schema: StrictSchema,
    transform?: Record<
      string,
      (
        node: Record<string, any>,
      ) => Record<string, any> | [string, Record<string, any>]
    >,
  ) {
    return this.server.migrateSchema(schema, transform)
  }

  putSchema(schema: Schema, fromStart: boolean = false): StrictSchema {
    return this.server.putSchema(schema, fromStart)
  }

  removeSchema() {
    // TODO fix
  }

  markNodeDirty(schema: SchemaTypeDef, nodeId: number): void {
    this.server.markNodeDirty(schema, nodeId)
  }

  create = create

  upserting: Map<
    string,
    { o: Record<string, any>; p: Promise<number | ModifyRes> }
  > = new Map()

  async upsert(type: string, obj: Record<string, any>) {
    const tree = this.schemaTypesParsed[type].tree
    let q: BasedDbQuery
    let id = ''

    for (const key in obj) {
      if (tree[key].typeIndex === ALIAS) {
        id += `${key}:${obj[key]};`
        if (q) {
          q = q.or(key, '=', obj[key])
        } else {
          q = this.query(type).include('id').filter(key, '=', obj[key])
        }
      }
    }

    if (!q) {
      throw new Error('no alias found for upsert operation')
    }

    if (this.upserting.has(id)) {
      const store = this.upserting.get(id)
      store.o = { ...store.o, ...obj }
      return store.p
    }

    const store = {
      o: obj,
      p: q.get().then((res) => {
        this.upserting.delete(id)
        if (res.length === 0) {
          return this.create(type, store.o)
        } else {
          return this.update(type, res.toObject()[0].id, store.o)
        }
      }),
    }

    this.upserting.set(id, store)
    return store.p
  }

  update(
    type: string,
    id: number | ModifyRes,
    value: any,
    overwrite?: boolean,
  ): ModifyRes

  update(value: any, overwrite?: boolean): ModifyRes

  update(
    typeOrValue: string | any,
    idOrOverwrite: number | ModifyRes | boolean,
    value?: any,
    overwrite?: boolean,
  ): ModifyRes {
    if (typeof typeOrValue === 'string') {
      const id =
        typeof idOrOverwrite === 'object' ? idOrOverwrite.tmpId : idOrOverwrite
      return update(this, typeOrValue, id as number, value, overwrite)
    }
    // else it is rootProps
    return update(this, '_root', 1, typeOrValue, idOrOverwrite as boolean)
  }

  remove(type: string, id: number | ModifyRes) {
    return remove(this, type, typeof id === 'number' ? id : id.tmpId)
  }

  flushModify() {
    flushBuffer(this)
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

  drain() {
    flushBuffer(this)
    const t = this.writeTime
    this.writeTime = 0
    return t
  }

  save() {
    return this.server.save()
  }

  async stop(noSave?: boolean) {
    this.modifyCtx.len = 0
    await this.server.stop(noSave)
  }

  async destroy() {
    this.modifyCtx.len = 0
    this.modifyCtx.db = null // Make sure we don't have a circular ref and leak mem
    await this.server.destroy()
  }
}
*/
