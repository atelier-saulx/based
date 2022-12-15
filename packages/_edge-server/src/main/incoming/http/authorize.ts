import { BasedServer } from '../../server'
import { BasedFunctionRoute, HttpClient } from '../../../types'
import { sendError } from '../../sendError'
import { BasedErrorCode } from '../../../error'

export const authorizeRequest = (
  server: BasedServer,
  client: HttpClient,
  payload: any,
  route: BasedFunctionRoute,
  authorized: (payload: any) => void,
  notAuth: () => void = () => undefined
) => {
  server.auth
    .authorize(client.context, route.name, payload)
    .then((ok) => {
      if (!client.res) {
        notAuth()
        return
      }
      if (!ok) {
        notAuth()
        sendError(server, client, BasedErrorCode.AuthorizeRejectedError, {
          route,
        })
      } else {
        authorized(payload)
      }
    })
    .catch((err) => {
      notAuth()
      sendError(server, client, BasedErrorCode.AuthorizeFunctionError, {
        route,
        err,
      })
    })
}
