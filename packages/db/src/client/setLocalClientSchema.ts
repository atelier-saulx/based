import type { updateTypeDefs } from '@based/schema/def'
import type { DbSchema } from '@based/schema'
import { DbClient } from '../index.ts'
import { cancel } from './modify/drain.ts'
import { Ctx } from './modify/Ctx.ts'

export const setLocalClientSchema = (client: DbClient, schema: DbSchema) => {
  if (client.schema && client.schema.hash === schema.hash) {
    return client.schema
  }
  const { schemaTypesParsed, schemaTypesParsedById } = updateTypeDefs(schema)
  client.schema = schema
  client.schemaTypesParsed = schemaTypesParsed
  client.schemaTypesParsedById = schemaTypesParsedById

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
