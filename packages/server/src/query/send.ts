import { Context, WebSocketSession, HttpSession } from '@based/functions'
import { updateId } from '../protocol.js'
import { BasedServer } from '../server.js'
import { destroyObs } from './destroy.js'
import { sendErrorData } from '../sendError.js'
import { ActiveObservable, ObservableError } from './types.js'

export const sendObsWs = (
  ctx: Context<WebSocketSession>,
  buffer: Uint8Array,
  obs: ActiveObservable,
) => {
  if (!ctx.session) {
    return
  }
  if (ctx.session.v < 2) {
    // needs to be TESTED!
    console.log('SEND OBS - OLD NEED TO DO SOMETHING prob transform')

    if (obs.reusedCache) {
      const prevId = updateId(buffer, obs.id)
      ctx.session.ws.send(buffer, true, false)
      buffer.set(prevId, 4)
    } else {
      ctx.session.ws.send(buffer, true, false)
    }
  } else {
    console.log('SEND OBS - NEW VERSION', ctx.session.v)

    if (obs.reusedCache) {
      const prevId = updateId(buffer, obs.id)
      ctx.session.ws.send(buffer, true, false)
      buffer.set(prevId, 4)
    } else {
      ctx.session.ws.send(buffer, true, false)
    }
    // else just use the cache
  }
}

export const sendObsGetError = (
  server: BasedServer,
  ctx: Context<WebSocketSession | HttpSession>,
  id: number,
  err: ObservableError,
) => {
  sendErrorData(ctx, err)
  destroyObs(server, id)
}
