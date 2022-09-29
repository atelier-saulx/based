import { BasedServer } from '../../server'
import { BasedFunctionRoute, HttpClient } from '../../types'
import { sendHttpError } from './send'

export const authorizeRequest = (
  server: BasedServer,
  client: HttpClient,
  payload: any,
  route: BasedFunctionRoute,
  authorized: (payload: any) => void
) => {
  server.auth.config
    .authorize(server, client, route.name, payload)
    .then((ok) => {
      if (!client.res) {
        return
      }
      if (!ok) {
        sendHttpError(
          client,
          `${route.name} unauthorized request`,
          401,
          'Unauthorized'
        )
      } else {
        authorized(payload)
      }
    })
    .catch((err) => sendHttpError(client, err.message, 401, 'Unauthorized'))
}