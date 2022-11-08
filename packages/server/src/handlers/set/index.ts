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
    const id = await server.db.set(payload)
    client.send([RequestTypes.Set, reqId, { id }])
  } catch (err) {
    client.send([
      RequestTypes.Set,
      reqId,
      0,
      { type: 'ValidationError', name: 'set', message: err.message, payload },
    ])
  }
}
