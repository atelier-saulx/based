import { DbClient } from '../index.js'
import { cancel } from './modify/drain.js'
import { Ctx } from './modify/Ctx.js'
import { schemaToTypeDefs, type SchemaOut } from '@based/schema'

export const setLocalClientSchema = (client: DbClient, schema: SchemaOut) => {
  if (client.schema && client.schema.hash === schema.hash) {
    return client.schema
  }
  client.schema = schema
  client.defs = schemaToTypeDefs(schema)

  if (client.modifyCtx.index > 8) {
    console.info('Modify cancelled - schema updated')
  }

  cancel(client.modifyCtx, Error('Schema changed - in-flight modify cancelled'))
  client.modifyCtx = new Ctx(schema, client.modifyCtx.array)

  // resubscribe
  for (const [q, store] of client.subs) {
    store.resubscribe(q)
  }

  process.nextTick(() => {
    client.emit('schema', schema)
  })

  return schema
}
