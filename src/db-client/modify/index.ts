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
  type ModifyErrorEnum,
} from '../../zigTsExports.js'
import { AutoSizedUint8Array } from './AutoSizedUint8Array.js'
import type { PropDef, PropTree, TypeDef } from './defs/index.js'
import { InferPayload } from './types.js'
import { getTypeDefs } from './defs/getTypeDefs.js'
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

export class ModifyItem implements Promise<number> {
  constructor(batch: ModifyBatch) {
    this._batch = batch
    this._index = batch.count
  }

  [Symbol.toStringTag]!: 'ModifyItem'

  private _p?: Promise<number>
  private _batch: ModifyBatch
  private get _promise() {
    if (!this._p) {
      this._p ??= new Promise((resolve, reject) => {
        this._resolve = resolve
        this._reject = reject
        this._batch.items ??= []
        this._batch.items.push(this)
      })
    }

    return this._p
  }

  _index: number
  _id?: number
  _err?: ModifyErrorEnum

  get id(): number | undefined {
    if (this._batch.result) {
      this._id = readUint32(this._batch.result, this._index * 5)
    }
    return this._id
  }

  get err(): ModifyErrorEnum | undefined {
    if (this._batch.result) {
      this._err = this._batch.result[this._index * 5 + 4] as ModifyErrorEnum
    }
    return this._err
  }

  _resolve?: (value: number | PromiseLike<number>) => void
  _reject?: (reason?: any) => void

  then<Res1 = number, Res2 = never>(
    onfulfilled?: ((value: number) => Res1 | PromiseLike<Res1>) | null,
    onrejected?: ((reason: any) => Res2 | PromiseLike<Res2>) | null,
  ): Promise<Res1 | Res2> {
    return this._promise.then(onfulfilled, onrejected)
  }
  catch<Res = never>(
    onrejected?: ((reason: any) => Res | PromiseLike<Res>) | null,
  ): Promise<number | Res> {
    return this._promise.catch(onrejected)
  }
  finally(onfinally?: (() => void) | null): Promise<number> {
    return this._promise.finally(onfinally)
  }
}

type ModifyBatch = {
  count: number
  items?: ModifyItem[]
  result?: Uint8Array
}

export type ModifyCtx = {
  buf: AutoSizedUint8Array
  batch: ModifyBatch
  flushTime: number
  lastModify?: ModifyItem
  flushTimer?: NodeJS.Timeout | true | undefined
  hooks: {
    flushModify: (buf: Uint8Array<ArrayBufferLike>) => Promise<Uint8Array>
  }
}

export const flush = (ctx: ModifyCtx) => {
  if (ctx.buf.length) {
    const batch = ctx.batch
    writeModifyHeaderProps.count(ctx.buf.data, batch.count, 0)
    ctx.hooks.flushModify(ctx.buf.view).then((result) => {
      batch.result = result
      if (batch.items) {
        for (const item of batch.items) {
          const id = item.id
          const err = item.err
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
}

export const schedule = (ctx: ModifyCtx) => {
  if (!ctx.flushTimer) {
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
}

export const modify = async <
  S extends
    | typeof serializeCreate
    | typeof serializeUpdate
    | typeof serializeDelete,
>(
  ctx: ModifyCtx,
  serialize: S,
  ...args: Parameters<S>
): Promise<number> => {
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
    ;(serialize as (...args: any[]) => void)(...args)
  } catch (e) {
    if (e === AutoSizedUint8Array.ERR_OVERFLOW) {
      if (isEmpty) {
        throw new Error('Range error')
      }
      ctx.buf.length = initialLength
      flush(ctx)
      return modify(ctx, serialize, ...args)
    } else {
      throw e
    }
  }

  const item = new ModifyItem(ctx.batch)
  ctx.lastModify = item
  ctx.batch.count++
  schedule(ctx)
  return item
}
