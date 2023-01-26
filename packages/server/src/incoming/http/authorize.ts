import { BasedServer } from '../../server'
import { BasedFunctionRoute } from '../../functions'
import { sendError } from '../../sendError'
import { BasedErrorCode } from '../../error'
import { HttpSession, Context } from '@based/functions'

export const authorizeRequest = (
  server: BasedServer,
  ctx: Context<HttpSession>,
  payload: any,
  route: BasedFunctionRoute,
  authorized: (payload: any) => void,
  notAuth: () => void = () => undefined
) => {
  if (route.public === true) {
    authorized(payload)
    return
  }

  server.auth
    .authorize(server, ctx, route.name, payload)
    .then((ok) => {
      if (!ctx.session) {
        notAuth()
        return
      }
      if (!ok) {
        notAuth()
        sendError(server, ctx, BasedErrorCode.AuthorizeRejectedError, {
          route,
        })
      } else {
        authorized(payload)
      }
    })
    .catch((err) => {
      notAuth()
      sendError(server, ctx, BasedErrorCode.AuthorizeFunctionError, {
        route,
        err,
      })
    })
}
