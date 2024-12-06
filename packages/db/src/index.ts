import { ModifyRes } from './client/modify/ModifyRes.js'
import { Schema } from '@based/schema'
import { SchemaTypeDef } from './server/schema/schema.js'
import { BasedDbQuery } from './client/query/BasedDbQuery.js'
import { ModifyCtx, flushBuffer } from './client/operations.js'
import { setTimeout } from 'node:timers/promises'
import { create, remove, update } from './client/modify/index.js'
import { migrate } from './server/migrate/index.js'
import { compress, decompress } from './client/string.js'
import { DbServer } from './server/index.js'

export * from './server/schema/typeDef.js'
export * from './client/modify/modify.js'

export { compress, decompress }
export { ModifyCtx } // TODO move this somewhere

export class BasedDb {
  isDraining: boolean = false
  maxModifySize: number = 100 * 1e3 * 1e3
  modifyCtx: ModifyCtx
  server: DbServer

  id: number
  // total write time until .drain is called manualy
  writeTime: number = 0
  fileSystemPath: string
  noCompression: boolean
  schemaTypesParsed: {
    [key: string]: SchemaTypeDef
  }
  constructor({
    path,
    maxModifySize,
    noCompression,
  }: {
    path: string
    maxModifySize?: number
    noCompression?: boolean
  }) {
    if (maxModifySize) {
      this.maxModifySize = maxModifySize
    }
    this.modifyCtx = new ModifyCtx(this)
    this.noCompression = noCompression || false
    this.fileSystemPath = path
  }

  async start(opts: { clean?: boolean } = {}): Promise<
    {
      shard: number
      field: number
      entries: number
      type: number[]
      lastId: number
    }[]
  > {
    this.server = new DbServer({
      path: this.fileSystemPath,
      maxModifySize: this.maxModifySize,
    })
    await this.server.start(opts)
    this.schemaTypesParsed = this.server.schemaTypesParsed
    return []
  }

  migrateSchema(
    schema: Schema,
    transform?: (
      type: string,
      node: Record<string, any>,
    ) => Record<string, any>,
  ) {
    return migrate(this, schema, transform)
  }

  putSchema(schema: Schema, fromStart: boolean = false): Schema {
    return this.server.putSchema(schema, fromStart)
  }

  removeSchema() {
    // TODO fix
  }

  markNodeDirty(schema: SchemaTypeDef, nodeId: number): void {
    this.server.markNodeDirty(schema, nodeId)
  }

  create(type: string, value: any, unsafe?: boolean): ModifyRes {
    return create(this, type, value, unsafe)
  }

  upsert(type: string, aliases: Record<string, string>, value: any) {
    console.warn('TODO upsert nice')
    for (const key in aliases) {
    }
  }

  update(
    type: string,
    id: number | ModifyRes,
    value: any,
    overwrite?: boolean,
  ): ModifyRes {
    return update(
      this,
      type,
      typeof id === 'number' ? id : id.tmpId,
      value,
      overwrite,
    )
  }

  remove(type: string, id: number | ModifyRes) {
    return remove(this, type, typeof id === 'number' ? id : id.tmpId)
  }

  query(
    type: string,
    id?: number | ModifyRes | (number | ModifyRes)[],
  ): BasedDbQuery {
    if (Array.isArray(id)) {
      let i = id.length
      while (i--) {
        if (typeof id[i] == 'object') {
          // @ts-ignore
          id[i] = id[i].tmpId
        }
      }
    } else if (typeof id == 'object') {
      id = id.tmpId
    }
    return new BasedDbQuery(this, type, id as number | number[])
  }

  drain() {
    flushBuffer(this)
    const t = this.writeTime
    this.writeTime = 0
    return t
  }

  save() {
    return this.server.save()
  }

  async stop(noSave?: boolean) {
    this.modifyCtx.len = 0
    await this.server.stop(noSave)
    await setTimeout()
  }

  async destroy() {
    this.modifyCtx.len = 0
    this.modifyCtx.db = null // Make sure we don't have a circular ref and leak mem
    await this.server.destroy()
  }
}
