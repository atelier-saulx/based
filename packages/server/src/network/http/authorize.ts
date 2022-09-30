import { BasedServer } from '../../server'
import { BasedFunctionRoute, HttpClient } from '../../types'
import { sendHttpError } from './send'
import { BasedErrorCode } from '../../error'

export const authorizeRequest = (
  server: BasedServer,
  client: HttpClient,
  payload: any,
  route: BasedFunctionRoute,
  authorized: (payload: any) => void,
  notAuthorized?: () => void
) => {
  server.auth.config
    .authorize(server, client, route.name, payload)
    .then((ok) => {
      if (!client.res) {
        return
      }
      if (!ok) {
        sendHttpError(client, BasedErrorCode.AuthorizeRejectedError, route.name)
        if (notAuthorized) {
          notAuthorized()
        }
      } else {
        authorized(payload)
      }
    })
    .catch((err) => {
      sendHttpError(client, BasedErrorCode.AuthorizeFunctionError, {
        name: route.name,
        err,
      })
      if (notAuthorized) {
        notAuthorized()
      }
    })
}
