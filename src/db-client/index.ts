import { BasedDbQuery, QueryByAliasObj } from './query/BasedDbQuery.js'
import { debugMode } from '../utils/debug.js'
import { SubStore } from './query/subscription/index.js'
import { DbShared } from '../shared/DbBase.js'
import { DbClientHooks } from './hooks.js'
import { setLocalClientSchema } from './setLocalClientSchema.js'
import {
  parse,
  type SchemaIn,
  type SchemaMigrateFns,
  type SchemaOut,
  type ResolveSchema,
  type Schema,
} from '../schema/index.js'
import { AutoSizedUint8Array } from '../utils/AutoSizedUint8Array.js'
import { LangCode, Modify } from '../zigTsExports.js'
import { ModifyCtx, flush, BasedModify } from './modify/index.js'
import type { InferPayload, InferTarget } from './modify/types.js'
import { serializeCreate } from './modify/create.js'
import { serializeUpdate } from './modify/update.js'
import { serializeDelete } from './modify/delete.js'
import { serializeUpsert } from './modify/upsert.js'
import { BasedQuery2 } from './query2/index.js'

type DbClientOpts = {
  hooks: DbClientHooks
  maxModifySize?: number
  flushTime?: number
  debug?: boolean
}

type BasedCreatePromise = BasedModify<typeof serializeCreate>
type BasedUpdatePromise = BasedModify<typeof serializeUpdate>
type BasedDeletePromise = BasedModify<typeof serializeDelete>
type BasedUpsertPromise = BasedModify<typeof serializeUpsert>
type BasedInsertPromise = BasedUpsertPromise

export type ModifyOpts = {
  unsafe?: boolean
  locale?: keyof typeof LangCode
}

export class DbClient<S extends Schema<any> = SchemaOut> extends DbShared {
  constructor({
    hooks,
    maxModifySize = 100 * 1e3 * 1e3,
    flushTime = 0,
    debug,
  }: DbClientOpts) {
    super()
    this.hooks = hooks
    this.modifyCtx = {
      buf: new AutoSizedUint8Array(256, maxModifySize),
      flushTime,
      batch: { count: 0 },
      hooks,
    }
    if (debug) {
      debugMode(this)
    }

    this.hooks.subscribeSchema((schema) => {
      setLocalClientSchema(this, schema)
    })
  }

  subs = new Map<BasedDbQuery, SubStore>()
  stopped!: boolean
  hooks: DbClientHooks
  modifyCtx: ModifyCtx

  async schemaIsSet() {
    if (!this.schema) {
      await this.once('schema')
    }
  }

  async setSchema<const T extends { types: any }>(
    schema: T,
    transformFns?: SchemaMigrateFns,
  ): Promise<DbClient<ResolveSchema<T>>> {
    const strictSchema = parse(schema as unknown as SchemaIn).schema
    await this.drain()
    const schemaChecksum = await this.hooks.setSchema(
      strictSchema as SchemaOut,
      transformFns,
    )
    if (this.stopped) {
      return this as unknown as DbClient<ResolveSchema<T>>
    }
    if (schemaChecksum !== this.schema?.hash) {
      await this.once('schema')
      return this as unknown as DbClient<ResolveSchema<T>>
    }
    return this as unknown as DbClient<ResolveSchema<T>>
  }

  query2<T extends keyof S['types'] & string = keyof S['types'] & string>(
    type: T,
  ): BasedQuery2<S, T, '*', false>
  query2<T extends keyof S['types'] & string = keyof S['types'] & string>(
    type: T,
    id: number,
  ): BasedQuery2<S, T, '*', true>
  query2<T extends keyof S['types'] & string = keyof S['types'] & string>(
    type: T,
    id?: number,
  ): BasedQuery2<S, T, '*', boolean> {
    return new BasedQuery2<S, T, '*', any>(type, id)
  }

  create<T extends keyof S['types'] & string = keyof S['types'] & string>(
    type: T,
    obj: InferPayload<S, T>,
    opts?: ModifyOpts,
  ): BasedCreatePromise {
    return new BasedModify(
      this.modifyCtx,
      serializeCreate,
      this.schema!,
      type,
      obj,
      this.modifyCtx.buf,
      opts?.locale ? LangCode[opts.locale] : LangCode.none,
    )
  }

  update<T extends keyof S['types'] & string = keyof S['types'] & string>(
    type: T,
    target: number | BasedModify,
    obj: InferPayload<S, T>,
    opts?: ModifyOpts,
  ): BasedUpdatePromise {
    return new BasedModify(
      this.modifyCtx,
      serializeUpdate,
      this.schema!,
      type,
      target,
      obj,
      this.modifyCtx.buf,
      opts?.locale ? LangCode[opts.locale] : LangCode.none,
    )
  }

  upsert<T extends keyof S['types'] & string = keyof S['types'] & string>(
    type: T,
    target: InferTarget<S, T>,
    obj: InferPayload<S, T>,
    opts?: ModifyOpts,
  ): BasedUpsertPromise {
    return new BasedModify(
      this.modifyCtx,
      serializeUpsert,
      this.schema!,
      type,
      target,
      obj,
      this.modifyCtx.buf,
      opts?.locale ? LangCode[opts.locale] : LangCode.none,
      Modify.upsert,
    )
  }

  insert<T extends keyof S['types'] & string = keyof S['types'] & string>(
    type: T,
    target: InferTarget<S, T>,
    obj: InferPayload<S, T>,
    opts?: ModifyOpts,
  ): BasedInsertPromise {
    return new BasedModify(
      this.modifyCtx,
      serializeUpsert,
      this.schema!,
      type,
      target,
      obj,
      this.modifyCtx.buf,
      opts?.locale ? LangCode[opts.locale] : LangCode.none,
      Modify.insert,
    )
  }

  delete(
    type: keyof S['types'] & string,
    target: number | BasedModify,
  ): BasedDeletePromise {
    return new BasedModify(
      this.modifyCtx,
      serializeDelete,
      this.schema!,
      type,
      target,
      this.modifyCtx.buf,
    )
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

  query(
    type: string,
    id?:
      | number
      | number[]
      | QueryByAliasObj
      | QueryByAliasObj[]
      | Uint32Array
      | { [alias: string]: string }, // alias
  ): BasedDbQuery {
    return new BasedDbQuery(this, type, id as number | number[] | Uint32Array)
  }

  destroy() {
    this.stop()
    this.listeners = {}
  }

  stop() {
    this.stopped = true
    for (const [, { onClose }] of this.subs) {
      onClose()
    }
    this.subs.clear()
    // cancel(this.modifyCtx, Error('Db stopped - in-flight modify cancelled'))
  }

  // For more advanced / internal usage - use isModified instead for most cases
  drain() {
    flush(this.modifyCtx)
    return this.isModified()
  }

  async isModified() {
    let lastModify
    while (lastModify !== this.modifyCtx.lastModify) {
      lastModify = this.modifyCtx.lastModify
      await lastModify.catch(noop)
    }
  }
}

function noop() {}
