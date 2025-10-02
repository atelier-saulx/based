import {
  StrictSchema,
  MigrateFns,
  DbSchema,
  SchemaChecksum,
} from '@based/schema'
import type { BasedDbQuery } from './client/query/BasedDbQuery.js'
import { OnClose, OnData, OnError } from './client/query/subscription/types.js'
import { DbServer } from './server/index.js'
import picocolors from 'picocolors'
import { displayTarget } from './client/query/display.js'

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
      let timer: ReturnType<typeof setTimeout>
      let killed = false
      const poll = async () => {
        const res = await server.getQueryBuf(q.buffer)
        if (killed) {
          return
        }
        if (res.byteLength >= 4) {
          onData(res)
        } else if (res.byteLength === 1 && res[0] === 0) {
          server.emit(
            'info',
            `[${displayTarget(q.def)}] Subscribe schema mismatch - should resolve after update`,
          )
          return
        } else {
          const def = q.def
          let name = picocolors.red(`QueryError[${displayTarget(def)}]\n`)
          name += `  Incorrect buffer received in subscription (maybe server not started ${res.byteLength}) bytes\n`
          onError(new Error(name))
        }
        timer = setTimeout(poll, subInterval)
      }

      void poll()

      return () => {
        clearTimeout(timer)
        killed = true
      }
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
