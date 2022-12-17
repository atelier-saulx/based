import { BasedServer } from '../server'
import { WebSocketSession, Context } from '../client'
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
  if (!ctx.session?.obs.has(id)) {
    return
  }
  const obs = server.activeObservablesById.get(id)
  ctx.session.obs.delete(id)
  if (!obs) {
    return
  }
  if (obs.clients.delete(ctx.session.id)) {
    destroyObs(server, id)
    return true
  }
}

export const unsubscribeWsIgnoreClient = (
  server: BasedServer,
  id: number,
  ctx: Context<WebSocketSession>
) => {
  if (!ctx.session) {
    return
  }

  const obs = server.activeObservablesById.get(id)

  if (!obs) {
    return
  }

  obs.clients.delete(ctx.session.id)

  destroyObs(server, id)
}
