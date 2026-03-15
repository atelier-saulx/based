import { DbServer } from '../db-server/index.js'
import type {
  // SchemaMigrateFns,
  SchemaOut,
} from '../schema/index.js'
import { readUint32 } from '../utils/uint8.js'
import type { OpTypeEnum } from '../zigTsExports.js'

export type DbClientHooks = {
  setSchema(
    schema: SchemaOut,
    // transformFns?: SchemaMigrateFns,
  ): Promise<SchemaOut['hash']>
  flushModify(buf: Uint8Array): Promise<Uint8Array>
  getQueryBuf(buf: Uint8Array): ReturnType<DbServer['getQueryBuf']>
  subscribe(buf: Uint8Array, onData: (buf: Uint8Array) => void): () => void
  subscribeSchema(cb: (schema: SchemaOut) => void): void
}

export const getDefaultHooks = (server: DbServer): DbClientHooks => {
  return {
    subscribe(buf, onData) {
      const size = readUint32(buf, 0)
      const id = readUint32(buf, size)
      const op = buf[size + 4] as OpTypeEnum
      server.subscribe(buf, (d) => onData(d.slice()))
      return () => server.unsubscribe(op, id, onData)
    },
    setSchema(
      schema: SchemaOut,
      // transformFns
    ) {
      return server.setSchema(
        schema,
        // , transformFns
      )
    },
    subscribeSchema(setSchema) {
      if (server.schema) {
        setSchema(server.schema)
      }
      server.on('schema', (schema) => {
        setSchema(schema)
      })
    },
    flushModify(buf: Uint8Array): Promise<Uint8Array> {
      const x = buf.slice(0)
      const res = server.modify(x)
      if (res instanceof Promise) {
        return res.then((res) => {
          server.keepRefAliveTillThisPoint(x)
          return new Uint8Array(res)
        })
      }

      return Promise.resolve(new Uint8Array(res))
    },
    getQueryBuf(buf: Uint8Array): Promise<Uint8Array> {
      return server.getQueryBuf(buf)
    },
  } satisfies DbClientHooks
}
