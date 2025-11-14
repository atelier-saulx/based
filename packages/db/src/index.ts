import { stringCompress } from './client/string.ts'
import { DbServer } from './server/index.ts'
import { DbClient } from './client/index.ts'
import { wait } from '@based/utils'
import { debugMode, debugServer } from './utils.ts'
import { getDefaultHooks } from './hooks.ts'
import { Emitter } from './shared/Emitter.ts'
import { BasedDbOpts } from './types.ts'
export { stringCompress }
export { DbClient, DbServer }
export { xxHash64 } from './client/xxHash64.ts'
export { crc32 } from './client/crc32.ts'
export { default as createHash } from './server/dbHash.ts'
export * from './utils.ts'
export * from './client/query/query.ts'
export * from './client/query/BasedDbQuery.ts'
export * from './client/query/BasedQueryResponse.ts'
export * from './server/save.ts'
export * from './hooks.ts'
export * from './server/subscription.ts'

export { getDefaultHooks, BasedDbOpts }

export class BasedDb extends Emitter {
  client: DbClient
  server: DbServer
  fileSystemPath: string
  maxModifySize: number

  constructor(opts: BasedDbOpts) {
    super()
    this.fileSystemPath = opts.path
    this.maxModifySize = opts.maxModifySize
    const server = new DbServer({
      path: opts.path,
      saveIntervalInSeconds: opts.saveIntervalInSeconds,
    })
    const client = new DbClient({
      maxModifySize: opts.maxModifySize,
      hooks: getDefaultHooks(server),
    })

    this.server = server
    this.client = client

    if (opts.debug) {
      if (opts.debug === 'client') {
        debugServer(this.server)
      } else if (opts.debug === 'server') {
        debugServer(this.server)
      } else {
        debugMode(this)
      }
    }
  }

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

  insert: DbClient['insert'] = function (this: BasedDb) {
    return this.client.insert.apply(this.client, arguments)
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

  schemaIsSet: DbClient['schemaIsSet'] = function (this: BasedDb) {
    return this.client.schemaIsSet.apply(this.client, arguments)
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

  isModified: DbClient['isModified'] = function (this: BasedDb) {
    return this.client.isModified.apply(this.client, arguments)
  }

  async destroy() {
    await this.isModified()
    // Tmp fix: Gives node time to GC existing buffers else it can incorrectly re-asign to mem
    // Todo: clear all active queries, queues ETC
    await wait(Math.max(this.client.flushTime + 10, 10))
    this.client.destroy()
    await this.server.destroy()
  }

  override on() {
    return this.client.on.apply(this.client, arguments)
  }

  override off() {
    return this.client.on.apply(this.client, arguments)
  }
}
