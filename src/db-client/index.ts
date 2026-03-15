import { debugMode } from '../utils/debug.js'
import { DbShared } from '../shared/DbBase.js'
import { DbClientHooks } from './hooks.js'
import { setLocalClientSchema } from './setLocalClientSchema.js'
import {
  parse,
  type SchemaIn,
  // type SchemaMigrateFns,
  type SchemaOut,
  // type ResolveSchema,
  // type StrictSchema,
} from '../schema/index.js'
import { AutoSizedUint8Array } from '../utils/AutoSizedUint8Array.js'
import { LangCode, Modify } from '../zigTsExports.js'
import { ModifyCtx, flush, BasedModify } from './modify/index.js'
import type { InferPayload, InferTarget } from './modify/types.js'
import { serializeCreate } from './modify/create.js'
import { serializeUpdate } from './modify/update.js'
import { serializeDelete } from './modify/delete.js'
import { serializeUpsert } from './modify/upsert.js'
import { DbQuery } from '../db-query/query/index.js'
import type { InferSchemaOutput } from '../db-query/query/types.js'
import type { ResolveSchema, StrictSchema } from '../schema/schema/schema.js'

type DbClientOpts = {
  hooks: DbClientHooks
  maxModifySize?: number
  flushTime?: number
  debug?: boolean
}

export type BasedCreatePromise = BasedModify<typeof serializeCreate>
export type BasedUpdatePromise = BasedModify<typeof serializeUpdate>
export type BasedDeletePromise = BasedModify<typeof serializeDelete>
export type BasedUpsertPromise = BasedModify<typeof serializeUpsert>
export type BasedInsertPromise = BasedUpsertPromise

export type ModifyOpts = {
  unsafe?: boolean
  locale?: keyof typeof LangCode
}

export class DbClientClass<
  S extends { types: any } = SchemaOut,
> extends DbShared {
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

  // subs = new Map<BasedDbQuery, SubStore>()
  stopped!: boolean
  hooks: DbClientHooks
  modifyCtx: ModifyCtx

  // async schemaIsSet() {
  //   if (!this.schema) {
  //     await this.once('schema')
  //   }
  // }

  async setSchema<const T extends SchemaIn>(
    schema: StrictSchema<T>,
    // transformFns?: SchemaMigrateFns,
  ): Promise<DbClientClass<ResolveSchema<T>>> {
    const strictSchema = parse(schema as any).schema
    await this.drain()
    const schemaChecksum = await this.hooks.setSchema(
      strictSchema as SchemaOut,
      // transformFns,
    )
    if (this.stopped) {
      return this as unknown as DbClientClass<ResolveSchema<T>>
    }
    if (schemaChecksum !== this.schema?.hash) {
      await this.once('schema')
      return this as unknown as DbClientClass<ResolveSchema<T>>
    }
    return this as unknown as DbClientClass<ResolveSchema<T>>
  }

  query<T extends keyof S['types'] & string = keyof S['types'] & string>(
    type: T,
    id?: number[],
  ): DbQuery<S, T, { $K: '*'; $Single: false }>

  query<T extends keyof S['types'] & string = keyof S['types'] & string>(
    type: T,
    id:
      | number
      | (Partial<InferSchemaOutput<S, T>> & { [Symbol.toStringTag]?: never }),
  ): DbQuery<S, T, { $K: '*'; $Single: true }>
  query<T extends keyof S['types'] & string = keyof S['types'] & string>(
    type: T,
    id?:
      | number
      | number[]
      | (Partial<InferSchemaOutput<S, T>> & { [Symbol.toStringTag]?: never }),
  ): any {
    return new DbQuery(this, type, id as any)
  }

  create<
    T extends keyof S['types'] & string = keyof S['types'] & string,
    Opts extends ModifyOpts = ModifyOpts,
  >(type: T, obj?: InferPayload<S, T, Opts>, opts?: Opts): BasedCreatePromise {
    return new BasedModify(
      this.modifyCtx,
      serializeCreate,
      this.schema!,
      type,
      obj ?? {},
      this.modifyCtx.buf,
      opts?.locale ? LangCode[opts.locale] : LangCode.none,
    )
  }

  update<
    T extends keyof S['types'] & string = keyof S['types'] & string,
    Opts extends ModifyOpts = ModifyOpts,
  >(
    type: T,
    target: number | BasedModify,
    obj: InferPayload<S, T, Opts>,
    opts?: Opts,
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

  upsert<
    T extends keyof S['types'] & string = keyof S['types'] & string,
    Opts extends ModifyOpts = ModifyOpts,
  >(
    type: T,
    target: InferTarget<S, T>,
    obj: InferPayload<S, T, Opts>,
    opts?: Opts,
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

  insert<
    T extends keyof S['types'] & string = keyof S['types'] & string,
    Opts extends ModifyOpts = ModifyOpts,
  >(
    type: T,
    target: InferTarget<S, T>,
    obj: InferPayload<S, T, Opts>,
    opts?: Opts,
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

  destroy() {
    this.stop()
    this.listeners = {}
  }

  stop() {
    this.stopped = true
    // for (const [, { onClose }] of this.subs) {
    //   onClose()
    // }
    // this.subs.clear()
    // cancel(this.modifyCtx, Error('Db stopped - in-flight modify cancelled'))
  }

  // For more advanced / internal usage - use isModified instead for most cases
  async drain(): Promise<number> {
    const start = Date.now()
    flush(this.modifyCtx)
    await this.isModified()
    return Date.now() - start
  }

  async isModified() {
    let lastModify
    while (lastModify !== this.modifyCtx.lastModify) {
      lastModify = this.modifyCtx.lastModify
      await lastModify.catch(noop)
    }
  }
}

export type DbClient<S extends { types: any } = SchemaOut> = DbClientClass<S>

export const DbClient = DbClientClass as {
  new <const S extends SchemaIn = SchemaOut>(
    opts: DbClientOpts,
  ): DbClient<ResolveSchema<S>>
}

function noop() {}
