import { DbClient } from '../index.js'
import { cancel } from './modify/drain.js'
import { Ctx, MODIFY_HEADER_SIZE } from './modify/Ctx.js'
import { updateTypeDefs, type SchemaOut } from '@based/schema'

export const setLocalClientSchema = (client: DbClient, schema: SchemaOut) => {
  if (client.schema && client.schema.hash === schema.hash) {
    return client.schema
  }
  const { schemaTypesParsed, schemaTypesParsedById } = updateTypeDefs(schema)
  client.schema = schema
  client.schemaTypesParsed = schemaTypesParsed
  client.schemaTypesParsedById = schemaTypesParsedById

  if (client.modifyCtx.index > MODIFY_HEADER_SIZE) {
    console.info('Modify cancelled - schema updated')
  }

  cancel(client.modifyCtx, Error('Schema changed - in-flight modify cancelled'))
  client.modifyCtx = new Ctx(schema.hash, client.modifyCtx.buf)

  // resubscribe
  for (const [q, store] of client.subs) {
    store.resubscribe(q)
  }

  process.nextTick(() => {
    client.emit('schema', schema)
  })

  return schema
}
