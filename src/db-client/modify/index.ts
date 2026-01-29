import { SchemaOut } from '../../schema.js'
import {
  Modify,
  pushModifyCreateHeader,
  pushModifyDeleteHeader,
  pushModifyHeader,
  pushModifyMainHeader,
  pushModifyPropHeader,
  pushModifyUpdateHeader,
  writeModifyCreateHeaderProps,
  writeModifyHeaderProps,
  writeModifyPropHeaderProps,
  writeModifyUpdateHeaderProps,
  type LangCodeEnum,
  type ModifyEnum,
} from '../../zigTsExports.js'
import { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import type { PropDef, PropTree } from '../../schema/defs/index.js'
import { InferPayload } from './types.js'
import { getTypeDefs } from '../../schema/defs/getTypeDefs.js'
import { readUint32 } from '../../utils/uint8.js'
export { getTypeDefs }

export const serializeProps = (
  tree: PropTree,
  data: any,
  buf: AutoSizedUint8Array,
  op: ModifyEnum,
  lang: LangCodeEnum,
) => {
  for (const key in data) {
    const def = tree.get(key)
    if (def === undefined) {
      continue
    }
    const val = data[key]
    if (def.constructor === Map) {
      if (val !== null && typeof val === 'object') {
        serializeProps(def, val, buf, op, lang)
      }
    } else {
      const prop = def as PropDef
      if (prop.size) {
        pushModifyMainHeader(buf, prop)
        prop.pushValue(buf, val, op, lang)
      } else {
        const index = pushModifyPropHeader(buf, prop)
        const start = buf.length
        prop.pushValue(buf, val, op, lang)
        writeModifyPropHeaderProps.size(buf.data, buf.length - start, index)
      }
    }
  }
}

const getTypeDef = (schema: SchemaOut, type: string) => {
  const typeDef = getTypeDefs(schema).get(type)
  if (!typeDef) {
    throw new Error(`Type ${type} not found`)
  }
  return typeDef
}

export const serializeCreate = <
  S extends SchemaOut = SchemaOut,
  T extends keyof S['types'] & string = keyof S['types'] & string,
>(
  schema: S,
  type: T,
  payload: InferPayload<S['types']>[T],
  buf: AutoSizedUint8Array,
  lang: LangCodeEnum,
) => {
  const typeDef = getTypeDef(schema, type)
  const index = pushModifyCreateHeader(buf, {
    op: Modify.create,
    type: typeDef.id,
    size: 0,
  })
  const start = buf.length
  serializeProps(typeDef.tree, payload, buf, Modify.create, lang)
  writeModifyCreateHeaderProps.size(buf.data, buf.length - start, index)
}

export const serializeUpdate = <
  S extends SchemaOut = SchemaOut,
  T extends keyof S['types'] & string = keyof S['types'] & string,
>(
  schema: S,
  type: T,
  id: number,
  payload: InferPayload<S['types']>[T],
  buf: AutoSizedUint8Array,
  lang: LangCodeEnum,
) => {
  const typeDef = getTypeDef(schema, type)
  const index = pushModifyUpdateHeader(buf, {
    op: Modify.update,
    type: typeDef.id,
    id,
    size: 0,
  })
  const start = buf.length
  serializeProps(typeDef.tree, payload, buf, Modify.update, lang)
  writeModifyUpdateHeaderProps.size(buf.data, buf.length - start, index)
}

export const serializeDelete = <
  S extends SchemaOut = SchemaOut,
  T extends keyof S['types'] & string = keyof S['types'] & string,
>(
  schema: S,
  type: T,
  id: number,
  buf: AutoSizedUint8Array,
) => {
  const typeDef = getTypeDef(schema, type)
  pushModifyDeleteHeader(buf, {
    op: Modify.delete,
    type: typeDef.id,
    id,
  })
}

type ModifySerializer =
  | typeof serializeCreate
  | typeof serializeUpdate
  | typeof serializeDelete

type ModifyBatch = {
  count: number
  promises?: ModifyCmd[]
  dependents?: ModifyCmd[]
  result?: Uint8Array
  flushed?: true
}

export type ModifyCtx = {
  buf: AutoSizedUint8Array
  batch: ModifyBatch
  flushTime: number
  lastModify?: ModifyCmd
  flushTimer?: NodeJS.Timeout | true | undefined
  hooks: {
    flushModify: (buf: Uint8Array<ArrayBufferLike>) => Promise<Uint8Array>
  }
}

export const flush = (ctx: ModifyCtx) => {
  if (ctx.buf.length === 0) return
  const batch = ctx.batch
  writeModifyHeaderProps.count(ctx.buf.data, batch.count, 0)
  batch.flushed = true
  ctx.hooks.flushModify(ctx.buf.view).then((result) => {
    batch.result = result
    const promises = batch.promises
    const dependents = batch.dependents
    if (dependents) {
      batch.dependents = undefined
      for (const item of dependents) {
        item._exec.apply(item, item._arguments)
        if (item._resolve) {
          item._await()
        }
      }
    }
    if (promises) {
      batch.promises = undefined
      for (const item of promises) {
        const id = item.id
        const err = item.error
        if (err) {
          item._reject!(err)
        } else {
          item._resolve!(id!)
        }
      }
    }
  })

  ctx.buf.flush()
  ctx.batch = { count: 0 }
}

const schedule = (ctx: ModifyCtx) => {
  if (ctx.flushTimer) return
  if (ctx.flushTime === 0) {
    ctx.flushTimer = true
    process.nextTick(() => {
      ctx.flushTimer = undefined
      flush(ctx)
    })
  } else {
    ctx.flushTimer = setTimeout(() => {
      ctx.flushTimer = undefined
      flush(ctx)
    }, ctx.flushTime)
  }
}

export class ModifyCmd<S extends ModifySerializer = ModifySerializer>
  implements Promise<number>
{
  [Symbol.toStringTag]!: 'ModifyCmd'
  constructor(ctx: ModifyCtx, serialize: S, ...args: Parameters<S>) {
    this._exec(ctx, serialize, ...args)
  }
  private _result() {
    if (this._batch?.result) {
      this._id = readUint32(this._batch.result, this._index! * 5)
      const errCode = this._batch.result[this._index! * 5 + 4]
      if (errCode) this._error = new Error('ModifyError: ' + errCode)
      this._batch = undefined
    }
  }
  get id(): number | undefined {
    this._result()
    return this._id
  }
  get error(): Error | undefined {
    this._result()
    return this._error
  }
  get tmpId(): number | undefined {
    if (this._batch && !this._batch.flushed) {
      return this._index
    }
  }
  get promise(): Promise<number> {
    this._promise ??= new Promise((resolve, reject) => {
      if (this.id) {
        resolve(this.id)
      } else if (this.error) {
        reject(this.error)
      } else {
        this._resolve = resolve
        this._reject = reject
        this._await()
      }
    })
    return this._promise
  }

  private _id?: number
  private _error?: Error
  private _blocker?: ModifyCmd
  private _index?: number
  private _batch?: ModifyBatch
  private _promise?: Promise<number>

  _arguments?: IArguments
  _resolve?: (value: number | PromiseLike<number>) => void
  _reject?: (reason?: any) => void
  _await() {
    if (this._batch) {
      this._batch.promises ??= []
      this._batch.promises.push(this)
    }
  }
  _exec(ctx: ModifyCtx, serialize: S, ...args: Parameters<S>) {
    const isEmpty = ctx.buf.length === 0
    if (isEmpty) {
      pushModifyHeader(ctx.buf, {
        opId: 0, // is filled on server
        opType: 0, // is filled on server
        schema: args[0].hash,
        count: 0,
      })
    }
    const initialLength = ctx.buf.length
    try {
      ;(serialize as any)(...args)
    } catch (e) {
      ctx.buf.length = initialLength
      if (e === AutoSizedUint8Array.ERR_OVERFLOW) {
        if (isEmpty) throw new Error('Range error')
        flush(ctx)
        this._exec.apply(this, arguments)
        return
      } else if (e instanceof ModifyCmd) {
        let blocker: ModifyCmd = e
        while (blocker._blocker) blocker = blocker._blocker
        blocker._batch!.dependents ??= []
        blocker._batch!.dependents.push(this)
        this._blocker = blocker
        this._arguments = arguments
        return
      } else if (this._arguments) {
        // its in async mode
        this._error = e
        this._reject?.(e)
        return
      } else {
        this._error = e
        throw e
      }
    }

    schedule(ctx)
    this._batch = ctx.batch
    this._index = ctx.batch.count++
    ctx.lastModify = this
  }

  then<Res1 = number, Res2 = never>(
    onfulfilled?: ((value: number) => Res1 | PromiseLike<Res1>) | null,
    onrejected?: ((reason: any) => Res2 | PromiseLike<Res2>) | null,
  ): Promise<Res1 | Res2> {
    return this.promise.then(onfulfilled, onrejected)
  }
  catch<Res = never>(
    onrejected?: ((reason: any) => Res | PromiseLike<Res>) | null,
  ): Promise<number | Res> {
    return this.promise.catch(onrejected)
  }
  finally(onfinally?: (() => void) | null): Promise<number> {
    return this.promise.finally(onfinally)
  }
}
