import { StrictSchema } from '@based/schema'
import { BasedDbQuery } from './client/query/BasedDbQuery.js'
import { OnClose, OnData, OnError } from './client/query/subscription/types.js'
import { DbServer } from './server/index.js'
import picocolors from 'picocolors'
import { displayTarget } from './client/query/display.js'
import { TransformFns } from './server/migrate/index.js'
import { DbSchema, SchemaChecksum } from './schema.js'

export type DbClientHooks = {
  setSchema(
    schema: StrictSchema,
    transformFns?: TransformFns,
  ): Promise<SchemaChecksum>
  flushModify(buf: Uint8Array): Promise<{
    offsets: Record<number, number>
    dbWriteTime?: number
  }>
  getQueryBuf(buf: Uint8Array): Promise<Uint8Array>
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
    setSchema(schema: StrictSchema) {
      return server.setSchema(schema)
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
      const d = performance.now()
      const offsets = server.modify(buf)
      const dbWriteTime = performance.now() - d
      return Promise.resolve({
        offsets,
        dbWriteTime,
      })
    },
    getQueryBuf(buf: Uint8Array) {
      return Promise.resolve(server.getQueryBuf(buf))
    },
  }
}
