import createDataStream from './stream'
import { BasedServer } from '../../../server'
import { sendHttpError } from '../send'
import { BasedFunctionRoute, HttpClient } from '../../../types'
import { authorizeRequest } from '../authorize'
import { httpFunction } from '../function'

export const httpStreamFunction = (
  server: BasedServer,
  client: HttpClient,
  payload: any,
  route: BasedFunctionRoute
) => {
  if (!client.res) {
    return
  }

  const size = client.context.headers['content-length']

  if (route.maxPayloadSize > -1 && route.maxPayloadSize < size) {
    sendHttpError(client, 'Payload Too Large', 413)
    return
  }

  const stream = createDataStream(client, size)

  const streamPayload = { payload, stream }

  // if de-authorized destroy stream! (add it to context!)
  authorizeRequest(server, client, streamPayload, route, (payload) => {
    httpFunction(route, payload, client, server)
  })
}
