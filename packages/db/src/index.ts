import { compress, decompress } from './client/string.js'
import { ModifyCtx } from './client/flushModify.js'
import { DbServer } from './server/index.js'
import { DbClient } from './client/index.js'
import picocolors from 'picocolors'
import { wait } from '@saulx/utils'
export * from './client/modify/modify.js'
export { compress, decompress }
export { ModifyCtx } // TODO move this somewhere
export { DbClient, DbServer }
export { xxHash64 } from './client/xxHash64.js'
export { crc32 } from './client/crc32.js'
export * from './client/query/serialize.js'
export * from './utils.js'

export class BasedDb {
  client: DbClient
  server: DbServer
  fileSystemPath: string
  maxModifySize: number

  constructor(opts: { path: string; maxModifySize?: number; debug?: boolean }) {
    this.#init(opts)

    if (opts.debug) {
      for (const key in this) {
        const fn = this[key]
        if (typeof fn === 'function') {
          // @ts-ignore
          this[key] = function () {
            const str = [`[${key}]`, ...arguments].join(' ')
            console.info(picocolors.dim(str))
            return fn.apply(this, arguments)
          }
        }
      }
    }
  }

  #init({ path, maxModifySize }: { path: string; maxModifySize?: number }) {
    this.fileSystemPath = path
    this.maxModifySize = maxModifySize
    const server = new DbServer({
      path,
      maxModifySize,
      onSchemaChange(schema) {
        client.putLocalSchema(schema)
      },
    })
    const client = new DbClient({
      maxModifySize,
      hooks: {
        flushTime: 0,
        setSchema(schema, fromStart) {
          return Promise.resolve(server.setSchema(schema, fromStart))
        },
        flushModify(buf) {
          const offsets = server.modify(buf)
          return Promise.resolve({
            offsets,
          })
        },
        flushReady: () => {},
        flushIsReady: new Promise(() => {}),
        getQueryBuf(buf) {
          return Promise.resolve(server.getQueryBuf(buf))
        },
      },
    })
    this.server = server
    this.client = client
  }

  // client
  create: DbClient['create'] = function () {
    return this.client.create.apply(this.client, arguments)
  }

  copy: DbClient['copy'] = function () {
    return this.client.copy.apply(this.client, arguments)
  }

  update: DbClient['update'] = function () {
    return this.client.update.apply(this.client, arguments)
  }

  upsert: DbClient['upsert'] = function () {
    return this.client.upsert.apply(this.client, arguments)
  }

  delete: DbClient['delete'] = function () {
    return this.client.delete.apply(this.client, arguments)
  }

  expire: DbClient['expire'] = function () {
    return this.client.expire.apply(this.client, arguments)
  }

  query: DbClient['query'] = function () {
    return this.client.query.apply(this.client, arguments)
  }

  setSchema: DbClient['setSchema'] = function () {
    return this.client.setSchema.apply(this.client, arguments)
  }

  putSchema: DbClient['setSchema'] = function () {
    console.warn(
      'URGENT: putSchema will be removed in next release. Use setSchema instead!',
    )
    return this.setSchema.apply(this, arguments)
  }

  drain: DbClient['drain'] = function () {
    return this.client.drain.apply(this.client, arguments)
  }

  // server
  start: DbServer['start'] = function () {
    return this.server.start.apply(this.server, arguments)
  }

  stop: DbServer['stop'] = function () {
    this.client.stop()
    return this.server.stop.apply(this.server, arguments)
  }

  save: DbServer['save'] = function () {
    return this.server.save.apply(this.server, arguments)
  }

  migrateSchema: DbServer['migrateSchema'] = function () {
    return this.server.migrateSchema.apply(this.server, arguments)
  }

  isReady: DbClient['isModified'] = function () {
    return this.client.isReady.apply(this.client, arguments)
  }

  async destroy() {
    // Tmp fix: Gives node time to GC existing buffers else it can incorrectly re-asign to mem
    // Todo: clear all active queries, queues ETC
    await wait(Math.max(this.client.hooks.flushTime + 10, 10))
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
}
