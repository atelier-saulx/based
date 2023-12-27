import { Context, WebSocketSession, HttpSession } from '@based/functions'
import { updateId } from '../protocol.js'
import { BasedServer } from '../server.js'
import { destroyObs } from './destroy.js'
import { sendErrorData } from '../sendError.js'
import { ActiveObservable, ObservableError } from './types.js'

export const sendObsWs = (
  ctx: Context<WebSocketSession>,
  buffer: Uint8Array,
  obs: ActiveObservable
) => {
  if (!ctx.session) {
    return
  }
  if (obs.reusedCache) {
    const prevId = updateId(buffer, obs.id)
    ctx.session.ws.send(buffer, true, false)
    buffer.set(prevId, 4)
  } else {
    ctx.session.ws.send(buffer, true, false)
  }
}

export const sendObsGetError = (
  server: BasedServer,
  ctx: Context<WebSocketSession | HttpSession>,
  id: number,
  err: ObservableError
) => {
  sendErrorData(ctx, err)
  destroyObs(server, id)
}
