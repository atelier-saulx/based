import { BasedServer } from '../..'
import Client from '../../Client'
import { RequestMessage, RequestTypes } from '@based/client'

export default async (
  server: BasedServer,
  client: Client,
  [, reqId, payload]: RequestMessage
) => {
  try {
    const { type, path, db } = payload

    let fieldRemoval: any = {}

    let y: any = {}
    fieldRemoval = y
    for (let i = 0; i < path.length - 1; i++) {
      const p = path[i]
      if (!y[p]) {
        y[p] = {}
      }
      y = y[p]
    }
    y[path[path.length - 1]] = { $delete: true }

    console.log(path, '---', JSON.stringify(fieldRemoval, null, 2))

    await server.db.updateSchema(
      {
        types: {
          [type]: {
            fields: fieldRemoval,
          },
        },
      },
      db || 'default',
      true
    )

    client.send([RequestTypes.RemoveField, reqId, { removed: true }])
  } catch (err) {
    client.send([
      RequestTypes.RemoveField,
      reqId,
      0,
      {
        type: 'ValidationError',
        name: 'removeField',
        message: err.message,
        payload,
      },
    ])
  }
}
