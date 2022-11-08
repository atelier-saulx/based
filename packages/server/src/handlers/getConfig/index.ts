import { BasedServer } from '../..'
import Client from '../../Client'
import { RequestMessage, RequestTypes, Configuration } from '@based/client'

export default async (
  server: BasedServer,
  client: Client,
  [, reqId]: RequestMessage
) => {
  // can do a check for subscriptions
  try {
    const config: Configuration = {
      dbs: [],
      schema: {},
      functions: {},
    }

    const s = server.db.servers

    if (!server.db.schemas) {
      await server.db.getSchema()
    }

    for (const db in s.origins) {
      config.dbs.push(db)
      if (!server.db.schemas[db]) {
        await server.db.getSchema(db)
      }
      config.schema[db] = server.db.schemas[db]
    }

    client.send([RequestTypes.GetConfiguration, reqId, config])
  } catch (err) {
    client.send([
      RequestTypes.GetConfiguration,
      reqId,
      0,
      {
        type: 'ValidationError',
        name: 'get configuration',
        message: err.message,
      },
    ])
  }
}
