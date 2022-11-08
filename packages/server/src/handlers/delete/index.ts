import { BasedServer } from '../..'
import Client from '../../Client'
import { RequestMessage, RequestTypes } from '@based/client'

export default async (
  server: BasedServer,
  client: Client,
  [, reqId, payload]: RequestMessage
) => {
  const deleteFile = server.config?.deleteFile
  try {
    if (deleteFile) {
      if (payload.$id.startsWith('fi')) {
        await deleteFile({
          id: payload.$id,
          db: payload.$db,
          based: server.based,
        })
      }

      // add special option to get all nested files back
      const isDeleted = await server.db.delete(
        <{ $id: string; $db?: string }>payload
      )
      client.send([RequestTypes.Delete, reqId, { isDeleted }])
    } else {
      const isDeleted = await server.db.delete(
        <{ $id: string; $db?: string }>payload
      )
      client.send([RequestTypes.Delete, reqId, { isDeleted }])
    }
  } catch (err) {
    console.error(err)
    client.send([
      RequestTypes.Set,
      reqId,
      0,
      { type: 'ValidationError', name: 'set', message: err.message, payload },
    ])
  }
}
