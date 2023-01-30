import { Context, WebSocketSession, HttpSession } from '@based/functions'
import { updateId } from '../protocol'
import { BasedServer } from '../server'
import { destroyObs } from './destroy'
import { BasedErrorCode, BasedErrorData } from '../error'
import { sendErrorData } from '../sendError'
import { ActiveObservable } from './types'

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
    ctx.session.send(buffer, true, false)
    buffer.set(prevId, 4)
  } else {
    ctx.session.send(buffer, true, false)
  }
}

export const sendObsGetError = (
  server: BasedServer,
  ctx: Context<WebSocketSession | HttpSession>,
  id: number,
  err: BasedErrorData<BasedErrorCode.ObservableFunctionError>
) => {
  sendErrorData(ctx, err)
  destroyObs(server, id)
}
