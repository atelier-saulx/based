import { compress, decompress } from './client/string.js'
import { ModifyCtx } from './client/operations.js'
import { DbServer } from './server/index.js'
import { DbClient } from './client/index.js'

export * from './server/schema/typeDef.js'
export * from './client/modify/modify.js'

export { compress, decompress }
export { ModifyCtx } // TODO move this somewhere
export { DbClient, DbServer }

export class BasedDb {
  client: DbClient
  server: DbServer
  fileSystemPath: string
  maxModifySize: number
  constructor({
    path,
    maxModifySize,
  }: {
    path: string
    maxModifySize?: number
  }) {
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
        putSchema(schema, fromStart) {
          return Promise.resolve(server.putSchema(schema, fromStart))
        },
        flushModify(buf) {
          server.modify(buf)
          return Promise.resolve({
            offsets: {},
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
  create: DbClient['create'] = function () {
    return this.client.create.apply(this.client, arguments)
  }

  update: DbClient['update'] = function () {
    return this.client.update.apply(this.client, arguments)
  }

  upsert: DbClient['upsert'] = function () {
    return this.client.upsert.apply(this.client, arguments)
  }

  remove: DbClient['remove'] = function () {
    return this.client.remove.apply(this.client, arguments)
  }

  query: DbClient['query'] = function () {
    return this.client.query.apply(this.client, arguments)
  }

  putSchema: DbClient['putSchema'] = function () {
    return this.client.putSchema.apply(this.client, arguments)
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

  // both
  destroy() {
    this.client.destroy()
    return this.server.destroy()
  }
}
