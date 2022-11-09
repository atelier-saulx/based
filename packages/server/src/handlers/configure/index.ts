import { BasedServer } from '../..'
import Client from '../../Client'
import { RequestMessage, RequestTypes } from '@based/client'

export default async (
  server: BasedServer,
  client: Client,
  [, reqId, payload]: RequestMessage
) => {
  try {
    if (Array.isArray(payload)) {
      const updatedSchema = await Promise.all(
        payload.map(async (configuration) => {
          let updatedSchema = false
          if (configuration.schema) {
            updatedSchema = true
            await server.db.updateSchema(
              configuration.schema,
              configuration.db || 'default'
            )
          }
          return updatedSchema
        })
      )
      client.send([
        RequestTypes.Configuration,
        reqId,
        { updatedSchema: updatedSchema.includes(true) },
      ])
    } else {
      let updatedSchema = false
      if (payload.schema) {
        updatedSchema = true
        await server.db.updateSchema(payload.schema, payload.db || 'default')
      }
      client.send([RequestTypes.Configuration, reqId, { updatedSchema }])
    }
  } catch (err) {
    client.send([
      RequestTypes.Configuration,
      reqId,
      0,
      {
        type: 'ValidationError',
        name: 'updateSchema',
        message: err.message,
        payload,
      },
    ])
  }
}
