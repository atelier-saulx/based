import { BasedServer } from '../..'
import Client from '../../Client'
import {
  RequestMessage,
  RequestTypes,
  generateSubscriptionId,
} from '@based/client'

export default async (
  server: BasedServer,
  client: Client,
  [, reqId, query]: RequestMessage
) => {
  // can do a check for subscriptions
  try {
    const id = generateSubscriptionId(query)
    // @ts-ignore
    const cache = server.subscriptions?.[id]?.observable?.cache

    const r = cache || (await server.db.get(query))
    // how to get the checksum
    client.send([RequestTypes.Get, reqId, r])
  } catch (err) {
    client.send([
      RequestTypes.Get,
      reqId,
      0,
      { type: 'ValidationError', name: 'get', message: err.message, query },
    ])
  }
}
