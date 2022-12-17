import { BasedServer } from '../server'
import { destroyObs } from './destroy'
import { Context, WebSocketSession, HttpSession } from '../client'
import { BasedErrorCode, BasedError } from '../error'
import { sendError } from '../sendError'

export const sendObsGetError = (
  server: BasedServer,
  ctx: Context<WebSocketSession | HttpSession>,
  id: number,
  name: string,
  err: BasedError<BasedErrorCode.ObservableFunctionError>
) => {
  sendError(server, ctx, err.code, {
    observableId: id,
    route: {
      name,
    },
    err: err,
  })
  destroyObs(server, id)
}
