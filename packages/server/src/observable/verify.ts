import { HttpSession, WebSocketSession, Context } from '../client'
import { BasedErrorCode } from '../error'
import { BasedServer } from '../server'
import { sendError } from '../sendError'
import { BasedFunctionRoute } from '../functions'

export const verifyRoute = (
  server: BasedServer,
  name: string,
  route: BasedFunctionRoute | false,
  ctx: Context<HttpSession | WebSocketSession>
): BasedFunctionRoute | false => {
  if (!route) {
    sendError(server, ctx, BasedErrorCode.FunctionNotFound, { name })
    return false
  }
  if (!route.observable) {
    sendError(server, ctx, BasedErrorCode.FunctionIsNotObservable, route)
    return false
  }
  return route
}
