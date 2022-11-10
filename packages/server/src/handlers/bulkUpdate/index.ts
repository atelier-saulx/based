import { BasedServer } from '../..'
import Client from '../../Client'
import { RequestMessage, RequestTypes } from '@based/client'
export default async (
  server: BasedServer,
  client: Client,
  [, reqId, payload]: RequestMessage
) => {
  if (typeof payload === 'string') throw new Error('payload cannot be a string')
  try {
    // @ts-ignore
    const id = await server.db.update(payload.payload, payload.query)
    client.send([RequestTypes.BulkUpdate, reqId, { id }])
  } catch (err) {
    client.send([
      RequestTypes.Set,
      reqId,
      0,
      {
        type: 'ValidationError',
        name: 'BulkUpdate',
        message: err.message,
        payload,
      },
    ])
  }
}
