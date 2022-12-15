import { HttpClient, WebsocketClient } from '../client'
import { BasedErrorCode } from '../error'
import { BasedServer } from '../server'
import { sendError } from '../sendError'
import { BasedFunctionRoute } from '../functions'

export const verifyRoute = (
  server: BasedServer,
  name: string,
  route: BasedFunctionRoute | false,
  client: WebsocketClient | HttpClient
): BasedFunctionRoute | false => {
  if (!route) {
    sendError(server, client, BasedErrorCode.FunctionNotFound, { name })
    return false
  }
  if (!route.observable) {
    sendError(server, client, BasedErrorCode.FunctionIsNotObservable, route)
    return false
  }
  return route
}
