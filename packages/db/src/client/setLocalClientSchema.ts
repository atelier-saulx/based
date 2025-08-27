import { schemaToSelvaBuffer, updateTypeDefs } from '@based/schema/def'
import { DbClient } from '../index.js'
import { DbSchema } from '../schema.js'
import { cancel } from './modify/drain.js'
import { Ctx } from './modify/Ctx.js'

export const setLocalClientSchema = (client: DbClient, schema: DbSchema) => {
  if (client.schema && client.schema.hash === schema.hash) {
    return client.schema
  }
  const { schemaTypesParsed, schemaTypesParsedById } = updateTypeDefs(schema)
  client.schema = schema
  client.schemaTypesParsed = schemaTypesParsed
  client.schemaTypesParsedById = schemaTypesParsedById
  // Adds bidrectional refs on defs... oh god why
  schemaToSelvaBuffer(client.schemaTypesParsed)
  // this has to happen before the listeners

  if (client.modifyCtx.index > 8) {
    console.info('Modify cancelled - schema updated')
  }

  cancel(client.modifyCtx, Error('Schema changed - in-flight modify cancelled'))
  client.modifyCtx = new Ctx(schema.hash, client.modifyCtx.array)

  // resubscribe
  for (const [q, store] of client.subs) {
    store.resubscribe(q)
  }

  process.nextTick(() => {
    client.emit('schema', schema)
  })

  return schema
}
