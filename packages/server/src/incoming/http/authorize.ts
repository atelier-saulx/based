import { BasedServer } from '../../server'
import { BasedFunctionRoute } from '../../functions'
import { sendError } from '../../sendError'
import { BasedErrorCode } from '../../error'
import { HttpSession, Context } from '@based/functions'

export const authorizeRequest = <P = any>(
  server: BasedServer,
  ctx: Context<HttpSession>,
  payload: P,
  route: BasedFunctionRoute,
  authorized: (payload: P) => void,
  notAuth: (payload: P) => void = () => undefined
) => {
  if (route.public === true) {
    authorized(payload)
    return
  }
  server.auth
    .authorize(server.client, ctx, route.name, payload)
    .then((ok) => {
      if (!ctx.session) {
        notAuth(payload)
        return
      }
      if (!ok) {
        notAuth(payload)
        sendError(server, ctx, BasedErrorCode.AuthorizeRejectedError, {
          route,
        })
      } else {
        authorized(payload)
      }
    })
    .catch((err) => {
      notAuth(payload)
      sendError(server, ctx, BasedErrorCode.AuthorizeFunctionError, {
        route,
        err,
      })
    })
}
