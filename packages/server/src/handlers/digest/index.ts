import { BasedServer } from '../..'
import Client from '../../Client'
import { RequestTypes, RequestMessage } from '@based/client'

export default async (
  server: BasedServer,
  client: Client,
  [, reqId, opts]: RequestMessage
) => {
  try {
    const r = server.db.digest(String(opts))
    client.send([RequestTypes.Digest, reqId, r])
  } catch (err) {
    console.error(err)
    client.send([
      RequestTypes.Digest,
      reqId,
      0,
      {
        type: 'ValidationError',
        name: 'rawRedis',
        message: err.message,
      },
    ])
  }
}
