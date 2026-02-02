import { SchemaOut } from '../../schema.js'
import {
  Modify,
  pushModifyDeleteHeader,
  pushModifyHeader,
  pushModifyUpdateHeader,
  writeModifyHeaderProps,
  writeModifyUpdateHeaderProps,
  type LangCodeEnum,
} from '../../zigTsExports.js'
import { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import { InferPayload } from './types.js'
import { getTypeDefs } from '../../schema/defs/getTypeDefs.js'
import { readUint32 } from '../../utils/uint8.js'
import { serializeProps } from './props.js'
import type { serializeCreate } from './create.js'
import type { serializeUpdate } from './update.js'
import type { serializeDelete } from './delete.js'
import type { serializeUpsert } from './upsert.js'
export { getTypeDefs }

export const getTypeDef = (schema: SchemaOut, type: string) => {
  const typeDef = getTypeDefs(schema).get(type)
  if (!typeDef) {
    throw new Error(`Type ${type} not found`)
  }
  return typeDef
}

export const getRealId = (item: unknown) => {
  if (typeof item === 'number') return item
  if (item instanceof BasedModify) return item.id
}

export const getTmpId = (item: unknown) => {
  if (item instanceof BasedModify) return item.tmpId
}

export const assignTarget = <
  H extends Record<string, any> & { id?: number; isTmp?: boolean },
>(
  item: unknown,
  header: H,
): H & { id: number; isTmp: boolean } => {
  const realId = getRealId(item)
  const id = realId || getTmpId(item)
  if (id === undefined) {
    if (item instanceof BasedModify) {
      throw item
    }
    throw new Error('Invalid id')
  }
  header.id = id
  header.isTmp = !realId
  return header as H & { id: number; isTmp: boolean }
}

type ModifySerializer =
  | typeof serializeCreate
  | typeof serializeUpdate
  | typeof serializeDelete
  | typeof serializeUpsert

type ModifyBatch = {
  count: number
  promises?: BasedModify<any>[]
  dependents?: BasedModify<any>[]
  result?: Uint8Array
  flushed?: true
}

export type ModifyCtx = {
  buf: AutoSizedUint8Array
  batch: ModifyBatch
  flushTime: number
  lastModify?: BasedModify<any>
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

  ctx.buf.length = 0
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

export class BasedModify<S extends (...args: any[]) => any = ModifySerializer>
  implements Promise<number>
{
  [Symbol.toStringTag]!: 'BasedModify'
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
  private _blocker?: BasedModify
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
      } else if (e instanceof BasedModify) {
        let blocker: BasedModify = e
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
