import { Context, WebSocketSession, HttpSession } from '@based/functions'
import { updateId, cacheV2toV1, diffV2toV1 } from '../protocol.js'
import { BasedServer } from '../server.js'
import { destroyObs } from './destroy.js'
import { sendErrorData } from '../sendError.js'
import { ActiveObservable, ObservableError } from './types.js'

export const sendObsWs = (
  ctx: Context<WebSocketSession>,
  buffer: Uint8Array,
  obs: ActiveObservable,
  isDiff: boolean,
) => {
  if (!ctx.session) {
    return
  }
  if (ctx.session.v < 2) {
    if (obs.reusedCache) {
      const id = obs.attachedCtx ? obs.attachedCtx.fromId : obs.id
      const prevId = updateId(buffer, id)
      if (isDiff) {
        ctx.session.ws.send(diffV2toV1(buffer), true, false)
      } else {
        ctx.session.ws.send(cacheV2toV1(buffer), true, false)
      }
      buffer.set(prevId, 4)
    } else {
      if (isDiff) {
        ctx.session.ws.send(diffV2toV1(buffer), true, false)
      } else {
        ctx.session.ws.send(cacheV2toV1(buffer), true, false)
      }
    }
  } else {
    if (obs.reusedCache) {
      const id = obs.attachedCtx ? obs.attachedCtx.fromId : obs.id
      const prevId = updateId(buffer, id)
      ctx.session.ws.send(buffer, true, false)
      buffer.set(prevId, 4)
    } else {
      ctx.session.ws.send(buffer, true, false)
    }
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
