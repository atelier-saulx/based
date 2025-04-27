import { compress, decompress } from './client/string.js'
import { ModifyCtx } from './client/flushModify.js'
import { DbServer } from './server/index.js'
import { DbClient } from './client/index.js'
import { wait } from '@saulx/utils'
import { debugMode, debugServer } from './utils.js'
import { BasedQueryResponse } from './client/query/BasedIterable.js'
export * from './client/modify/modify.js'
export { compress, decompress }
export { ModifyCtx } // TODO move this somewhere
export { DbClient, DbServer }
export { xxHash64 } from './client/xxHash64.js'
export { crc32 } from './client/crc32.js'
export * from './client/query/serialize.js'
export * from './utils.js'
export * from './client/query/query.js'
export * from './client/query/BasedDbQuery.js'
export * from './client/query/BasedIterable.js'

export class BasedDb {
  client: DbClient
  server: DbServer
  fileSystemPath: string
  maxModifySize: number

  constructor(opts: {
    path: string
    maxModifySize?: number
    debug?: boolean | 'server'
    saveIntervalInSeconds?: number
  }) {
    this.#init(opts)

    if (opts.debug) {
      if (opts.debug === 'server') {
        debugServer(this.server)
      } else {
        debugMode(this)
      }
    }
  }

  #init({
    path,
    maxModifySize,
    saveIntervalInSeconds,
  }: {
    path: string
    maxModifySize?: number
    saveIntervalInSeconds?: number
  }) {
    this.fileSystemPath = path
    this.maxModifySize = maxModifySize
    const server = new DbServer({
      path,
      maxModifySize,
      saveIntervalInSeconds,
      onSchemaChange(schema) {
        client.putLocalSchema(schema)
      },
    })
    const client = new DbClient({
      maxModifySize,
      hooks: {
        subscribe(q, onData, onError) {
          let timer: ReturnType<typeof setTimeout>
          let prevChecksum: number
          let lastLen = 0
          let response: BasedQueryResponse
          const get = async () => {
            const res = await server.getQueryBuf(q.buffer)
            if (!response) {
              response = new BasedQueryResponse(q.id, q.def, res, 0)
            } else {
              response.result = res
              response.end = res.byteLength
            }
            const checksum = response.checksum
            if (lastLen != res.byteLength || checksum != prevChecksum) {
              onData(response)
              lastLen = res.byteLength
              prevChecksum = checksum
            }
            setTimeout(get, 200)
          }
          get()
          return () => {
            clearTimeout(timer)
          }
        },
        setSchema(schema, fromStart) {
          return Promise.resolve(server.setSchema(schema, fromStart))
        },
        flushModify(buf) {
          const d = performance.now()
          const offsets = server.modify(buf)
          const dbWriteTime = performance.now() - d
          return Promise.resolve({
            offsets,
            dbWriteTime,
          })
        },
        getQueryBuf(buf) {
          return Promise.resolve(server.getQueryBuf(buf))
        },
      },
    })
    this.server = server
    this.client = client
  }

  // client
  create: DbClient['create'] = function (this: BasedDb) {
    return this.client.create.apply(this.client, arguments)
  }

  copy: DbClient['copy'] = function (this: BasedDb) {
    return this.client.copy.apply(this.client, arguments)
  }

  update: DbClient['update'] = function (this: BasedDb) {
    return this.client.update.apply(this.client, arguments)
  }

  upsert: DbClient['upsert'] = function (this: BasedDb) {
    return this.client.upsert.apply(this.client, arguments)
  }

  delete: DbClient['delete'] = function (this: BasedDb) {
    return this.client.delete.apply(this.client, arguments)
  }

  expire: DbClient['expire'] = function (this: BasedDb) {
    return this.client.expire.apply(this.client, arguments)
  }

  query: DbClient['query'] = function (this: BasedDb) {
    return this.client.query.apply(this.client, arguments)
  }

  setSchema: DbClient['setSchema'] = function (this: BasedDb) {
    return this.client.setSchema.apply(this.client, arguments)
  }

  putSchema: DbClient['setSchema'] = function (this: BasedDb) {
    console.warn(
      'URGENT: putSchema will be removed in next release. Use setSchema instead!',
    )
    return this.setSchema.apply(this, arguments)
  }

  drain: DbClient['drain'] = function (this: BasedDb) {
    return this.client.drain.apply(this.client, arguments)
  }

  // server
  start: DbServer['start'] = function (this: BasedDb) {
    return this.server.start.apply(this.server, arguments)
  }

  stop: DbServer['stop'] = async function (this: BasedDb) {
    await this.isModified()
    this.client.stop()
    return this.server.stop.apply(this.server, arguments)
  }

  save: DbServer['save'] = async function (this: BasedDb) {
    await this.isModified()
    return this.server.save.apply(this.server, arguments)
  }

  migrateSchema: DbServer['migrateSchema'] = function (this: BasedDb) {
    return this.server.migrateSchema.apply(this.server, arguments)
  }

  isModified: DbClient['isModified'] = function (this: BasedDb) {
    return this.client.isModified.apply(this.client, arguments)
  }

  schemaIsSet: DbClient['schemaIsSet'] = function (this: BasedDb) {
    return this.client.schemaIsSet.apply(this.client, arguments)
  }

  async destroy() {
    await this.isModified()
    // Tmp fix: Gives node time to GC existing buffers else it can incorrectly re-asign to mem
    // Todo: clear all active queries, queues ETC
    await wait(Math.max(this.client.flushTime + 10, 10))
    this.client.destroy()
    await this.server.destroy()
  }

  async wipe() {
    const opts = {
      maxModifySize: this.maxModifySize,
      path: this.fileSystemPath,
    }
    await this.destroy()
    this.#init(opts)
    await this.start({ clean: true })
  }

  on: DbClient['on'] = function (this: BasedDb) {
    return this.client.on.apply(this.client, arguments)
  }

  off: DbClient['off'] = function (this: BasedDb) {
    return this.client.on.apply(this.client, arguments)
  }
}
