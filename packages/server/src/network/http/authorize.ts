import { BasedServer } from '../../server'
import { BasedFunctionRoute, HttpClient } from '../../types'
import { sendHttpError } from './send'
import { BasedErrorCode } from '../../error'

export const authorizeRequest = (
  server: BasedServer,
  client: HttpClient,
  payload: any,
  route: BasedFunctionRoute,
  authorized: (payload: any) => void
) => {
  server.auth
    .authorize(client.context, route.name, payload)
    .then((ok) => {
      if (!client.res) {
        return
      }
      if (!ok) {
        sendHttpError(
          server,
          client,
          BasedErrorCode.AuthorizeRejectedError,
          route
        )
      } else {
        authorized(payload)
      }
    })
    .catch((err) => {
      sendHttpError(server, client, BasedErrorCode.AuthorizeFunctionError, {
        route,
        err,
      })
    })
}
