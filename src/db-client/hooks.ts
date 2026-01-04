import { OnClose, OnData, OnError } from './query/subscription/types.js'
import { DbServer } from '../db-server/index.js'
import { registerSubscription } from '../db-server/subscription.js'
import type { BasedDbQuery } from './query/BasedDbQuery.js'
import type { SchemaMigrateFns, SchemaOut } from '../schema/index.js'

export type DbClientHooks = {
  setSchema(
    schema: SchemaOut,
    transformFns?: SchemaMigrateFns,
  ): Promise<SchemaOut['hash']>
  flushModify(buf: Uint8Array): Promise<Uint8Array | null>
  getQueryBuf(buf: Uint8Array): ReturnType<DbServer['getQueryBuf']>
  subscribe(
    q: BasedDbQuery,
    onData: (buf: Uint8Array) => ReturnType<OnData>,
    onError: OnError,
  ): Promise<OnClose>
  subscribeSchema(cb: (schema: SchemaOut) => void): void
}

export const getDefaultHooks = (server: DbServer): DbClientHooks => {
  return {
    subscribe(
      q: BasedDbQuery,
      onData: (res: Uint8Array) => void,
      onError: OnError,
    ) {
      return registerSubscription(
        server,
        q.buffer!,
        q.subscriptionBuffer!,
        onData,
        onError,
      )
    },
    setSchema(schema: SchemaOut, transformFns) {
      return server.setSchema(schema, transformFns)
    },
    subscribeSchema(setSchema) {
      if (server.schema) {
        setSchema(server.schema)
      }
      server.on('schema', (schema) => {
        setSchema(schema)
      })
    },
    flushModify(buf: Uint8Array) {
      const x = buf.slice(0)
      const res = server.modify(x)
      if (res instanceof Promise) {
        return res.then((res) => {
          server.keepRefAliveTillThisPoint(x)
          return res && new Uint8Array(res)
        })
      }
      return Promise.resolve(res && new Uint8Array(res))
    },
    getQueryBuf(buf: Uint8Array) {
      return server.getQueryBuf(buf)
    },
  }
}
