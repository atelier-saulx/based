import { BasedServer } from '../server'
import { WebsocketClient } from '../client'
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
  client: WebsocketClient
): true | void => {
  if (!client.ws) {
    return
  }
  if (!client.ws.obs.has(id)) {
    return
  }
  const obs = server.activeObservablesById.get(id)
  client.ws.obs.delete(id)
  if (!obs) {
    return
  }
  if (obs.clients.delete(client.ws.id)) {
    destroyObs(server, id)
    return true
  }
}

export const unsubscribeWsIgnoreClient = (
  server: BasedServer,
  id: number,
  client: WebsocketClient
) => {
  if (!client.ws) {
    return
  }

  const obs = server.activeObservablesById.get(id)

  if (!obs) {
    return
  }

  obs.clients.delete(client.ws.id)

  destroyObs(server, id)
}
