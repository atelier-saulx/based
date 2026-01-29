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
import { LangCode } from '../zigTsExports.js'
import {
  serializeCreate,
  serializeDelete,
  serializeUpdate,
  ModifyCtx,
  flush,
  ModifyCmd,
} from './modify/index.js'
import type { InferPayload } from './modify/types.js'

type DbClientOpts = {
  hooks: DbClientHooks
  maxModifySize?: number
  flushTime?: number
  debug?: boolean
}

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

  create<T extends keyof S['types'] & string = keyof S['types'] & string>(
    type: T,
    obj: InferPayload<S['types']>[T],
    opts?: ModifyOpts,
  ): ModifyCmd {
    return new ModifyCmd(
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
    id: number,
    obj: InferPayload<S['types']>[T],
    opts?: ModifyOpts,
  ): ModifyCmd {
    return new ModifyCmd(
      this.modifyCtx,
      serializeUpdate,
      this.schema!,
      type,
      id,
      obj,
      this.modifyCtx.buf,
      opts?.locale ? LangCode[opts.locale] : LangCode.none,
    )
  }

  delete(type: keyof S['types'] & string, id: number): ModifyCmd {
    return new ModifyCmd(
      this.modifyCtx,
      serializeDelete,
      this.schema!,
      type,
      // TODO make it perf
      id,
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
