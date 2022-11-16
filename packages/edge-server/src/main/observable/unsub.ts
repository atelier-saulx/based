import { BasedServer } from '../server'
import { WebsocketClient, WorkerClient } from '../../types'
import { destroyObs } from './destroy'

export const unsubscribeWorker = (
  server: BasedServer,
  id: number,
  client: WorkerClient
): true | void => {
  if (!client.worker.nestedObservers.has(id)) {
    return
  }
  const obs = server.activeObservablesById.get(id)
  client.worker.nestedObservers.delete(id)
  if (!obs) {
    return
  }
  if (obs.workers.delete(client.worker)) {
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
