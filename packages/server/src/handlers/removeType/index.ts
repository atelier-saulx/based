import { BasedServer } from '../..'
import Client from '../../Client'
import { RequestMessage, RequestTypes } from '@based/client'

export default async (
  server: BasedServer,
  client: Client,
  [, reqId, payload]: RequestMessage
) => {
  try {
    const { type, db } = payload

    await server.db.updateSchema(
      {
        types: {
          [type]: {
            $delete: true,
          },
        },
      },
      db || 'default',
      true
    )

    client.send([RequestTypes.RemoveType, reqId, { removed: true }])
  } catch (err) {
    client.send([
      RequestTypes.RemoveType,
      reqId,
      0,
      {
        type: 'ValidationError',
        name: 'removeType',
        message: err.message,
        payload,
      },
    ])
  }
}
