import {
  StrictSchema,
  MigrateFns,
  DbSchema,
  SchemaChecksum,
} from '@based/schema'
import type { BasedDbQuery } from './client/query/BasedDbQuery.js'
import { OnClose, OnData, OnError } from './client/query/subscription/types.js'
import { DbServer } from './server/index.js'
import { registerSubscription } from './server/subscription.js'

export type DbClientHooks = {
  setSchema(
    schema: StrictSchema,
    transformFns?: MigrateFns,
  ): Promise<SchemaChecksum>
  flushModify(buf: Uint8Array): Promise<Uint8Array | null>
  getQueryBuf(buf: Uint8Array): ReturnType<DbServer['getQueryBuf']>
  subscribe(
    q: BasedDbQuery,
    onData: (buf: Uint8Array) => ReturnType<OnData>,
    onError?: OnError,
  ): OnClose
  subscribeSchema(cb: (schema: DbSchema) => void): void
}

export const getDefaultHooks = (
  server: DbServer,
  subInterval = 200,
): DbClientHooks => {
  return {
    subscribe(
      q: BasedDbQuery,
      onData: (res: Uint8Array) => void,
      onError: OnError,
    ) {
      return registerSubscription(
        server,
        q.buffer,
        q.subscriptionBuffer,
        onData,
        onError,
        subInterval,
      )
    },
    setSchema(schema: StrictSchema, transformFns) {
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
      const res = server.modify(buf)
      if (res instanceof Promise) {
        return res.then((res) => res && new Uint8Array(res))
      }
      return Promise.resolve(res && new Uint8Array(res))
    },
    getQueryBuf(buf: Uint8Array) {
      return server.getQueryBuf(buf)
    },
  }
}
