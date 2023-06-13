import { BasedServer } from '../server'
import { WebSocketSession, Context } from '@based/functions'
import { destroyObs } from './destroy'
import { ObservableUpdateFunction } from './types'

export const unsubscribeFunction = (
  server: BasedServer,
  id: number,
  update: ObservableUpdateFunction
): true | void => {
  const obs = server.activeObservablesById.get(id)
  if (!obs) {
    return
  }
  if (obs.functionObserveClients.delete(update)) {
    destroyObs(server, id)
    return true
  }
}

export const unsubscribeWs = (
  server: BasedServer,
  id: number,
  ctx: Context<WebSocketSession>
): true | void => {
  const session = ctx.session
  if (!session || !session.obs.has(id)) {
    return
  }
  ctx.session.ws.unsubscribe(String(id))
  const obs = server.activeObservablesById.get(id)
  session.obs.delete(id)
  if (!obs) {
    return
  }
  if (obs.clients.delete(session.id)) {
    if (server.queryEvents) {
      server.queryEvents.unsubscribe(obs, ctx)
    }
    destroyObs(server, id)
    return true
  }
}

export const unsubscribeWsIgnoreClient = (
  server: BasedServer,
  id: number,
  ctx: Context<WebSocketSession>
): true | void => {
  const session = ctx.session
  if (!session) {
    return
  }
  const obs = server.activeObservablesById.get(id)
  if (!obs) {
    return true
  }
  if (obs.clients.delete(session.id) && server.queryEvents) {
    server.queryEvents.unsubscribe(obs, ctx)
  }
  destroyObs(server, id)
}
