import type {
  InferSchemaOutput,
  QueryOpts,
  MergeOpts,
  QueryRes,
} from './types.js'
import { astToQueryCtx } from '../ast/toCtx.js'
import { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import type { DbClient } from '../../sdk.js'
import { proxyResult } from './result.js'
import { Query } from './Query.js'
import {
  OpType,
  pushSubscriptionHeader,
  SubscriptionHeaderByteSize,
} from '../../zigTsExports.js'
import { getTypeDefs } from '../../schema/defs/getTypeDefs.js'
import { readUint32 } from '../../utils/uint8.js'

const logError = (err: Error) => console.error(err)

const isReadyToQuery = async (db: DbClient) => {
  while (!db.schema) await db.once('schema')
  return db.isModified()
}

export class DbQuery<
  Schema extends { types: any; locales?: any } = { types: any },
  Type extends keyof Schema['types'] = any,
  Opts extends QueryOpts = {},
> extends Query<Schema, Type, MergeOpts<Opts, { $Root: true }>> {
  constructor(
    db: DbClient,
    type: Type,
    target?: number | number[] | Partial<InferSchemaOutput<Schema, Type>>,
  ) {
    super({})
    this.ast.type = type as string
    if (target) this.ast.target = target
    this.db = db
  }

  db: DbClient
  async get(): Promise<QueryRes<Schema, Type, Opts>> {
    await isReadyToQuery(this.db)
    const ctx = astToQueryCtx(
      this.db.schema!,
      this.ast,
      new AutoSizedUint8Array(),
    )
    const result = await this.db.hooks.getQueryBuf(ctx.query)
    return proxyResult(result, ctx.readSchema)
  }

  subscribe(
    onData: (res: QueryRes<Schema, Type, Opts>) => void,
    onError: (err: Error) => void = logError,
  ) {
    let killed = false
    let remove: (() => void) | undefined
    isReadyToQuery(this.db).then(async () => {
      if (killed) return
      try {
        const ctx = astToQueryCtx(
          this.db.schema!,
          this.ast,
          new AutoSizedUint8Array(),
          true,
        )
        remove = this.db.hooks.subscribe(ctx.query, (result: Uint8Array) => {
          if (killed) {
            remove?.()
          } else if (result.byteLength === 1) {
            // it's an error
            console.error('error in subscribe', result)
          } else {
            onData(proxyResult(result, ctx.readSchema))
          }
        })
      } catch (e) {
        onError(e)
      }
    })
    return () => {
      killed = true
      if (remove) {
        remove()
        remove = undefined
      }
    }
  }
}
