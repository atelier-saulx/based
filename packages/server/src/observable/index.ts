import { BasedServer } from '../server'
import { ActiveObservable, WebsocketClient, WorkerClient } from '../types'

export const destroy = (server: BasedServer, id: number) => {
  const obs = server.activeObservablesById.get(id)

  if (!obs) {
    console.error('Observable', id, 'does not exists')
    return
  }

  if (obs.isDestroyed) {
    return
  }

  if (obs.clients.size || obs.workers.size) {
    return
  }

  const spec = server.functions.observables[obs.name]

  if (!spec) {
    console.warn('Cannot find observable function spec!', obs.name)
    return
  }

  const memCacheTimeout =
    spec.memCacheTimeout ?? server.functions.config.memCacheTimeout

  if (!obs.beingDestroyed) {
    obs.beingDestroyed = setTimeout(() => {
      if (!server.activeObservables[obs.name]) {
        console.info('Trying to destroy a removed observable function')
        return
      }
      obs.beingDestroyed = null
      server.activeObservables[obs.name].delete(id)
      if (server.activeObservables[obs.name].size === 0) {
        delete server.activeObservables[obs.name]
      }
      server.activeObservablesById.delete(id)
      obs.isDestroyed = true
      obs.closeFunction()
    }, memCacheTimeout)
  }
}

export const subscribe = (
  server: BasedServer,
  id: number,
  checksum: number,
  client: WebsocketClient
) => {
  if (!client.ws) {
    return
  }
  const obs = server.activeObservablesById.get(id)
  client.ws.obs.add(id)
  if (obs.beingDestroyed) {
    clearTimeout(obs.beingDestroyed)
    obs.beingDestroyed = null
  }
  obs.clients.add(client.ws.id)
  if (obs.cache && obs.checksum !== checksum) {
    if (obs.diffCache && obs.previousChecksum === checksum) {
      client.ws.send(obs.diffCache, true, false)
    } else {
      client.ws.send(obs.cache, true, false)
    }
  }
}

export const subscribeWorker = (
  server: BasedServer,
  id: number,
  checksum: number,
  client: WorkerClient
) => {
  const obs = server.activeObservablesById.get(id)
  client.worker.nestedObservers.add(id)
  if (obs.beingDestroyed) {
    clearTimeout(obs.beingDestroyed)
    obs.beingDestroyed = null
  }
  obs.workers.add(client.worker)
  if (obs.cache && obs.checksum !== checksum) {
    client.worker.worker.postMessage({
      type: 8,
      id,
      data: obs.cache,
    })
  }
}

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
    destroy(server, id)
    return true
  }
}

export const unsubscribe = (
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
    destroy(server, id)
    return true
  }
}

export const unsubscribeIgnoreClient = (
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

  destroy(server, id)
}

export const initFunction = async (
  server: BasedServer,
  id: number
): Promise<void> => {
  const obs = server.activeObservablesById.get(id)

  if (obs.closeFunction) {
    obs.closeFunction()
    delete obs.closeFunction
  }

  const spec = server.functions.observables[obs.name]

  if (!spec) {
    console.warn('Cannot find observable function spec!', obs.name)
    return
  }

  const payload = obs.payload

  const close = server.functions.runObservableFunction(
    spec,
    id,
    // add isDeflate for http
    (err) => {
      if (err) {
        console.error('ERROR TIMES /w observable', err)
      }
    },
    (encodedDiffData, encodedData, checksum, isDeflate) => {
      obs.previousChecksum = obs.checksum
      obs.checksum = checksum
      obs.cache = encodedData
      obs.isDeflate = isDeflate

      if (encodedDiffData) {
        obs.diffCache = encodedDiffData
      }

      if (obs.clients.size) {
        if (encodedDiffData) {
          server.uwsApp.publish(String(id), encodedDiffData, true, false)
        } else {
          server.uwsApp.publish(String(id), encodedData, true, false)
        }
      }

      if (obs.workers.size) {
        obs.workers.forEach((w) => {
          w.worker.postMessage({
            type: 8,
            id,
            checksum,
            diff: encodedDiffData,
            previousChecksum: obs.previousChecksum,
            data: obs.cache,
            isDeflate: obs.isDeflate,
          })
        })
      }

      if (obs.onNextData) {
        const onNextData = obs.onNextData
        delete obs.onNextData
        onNextData.forEach((fn) => fn())
      }
    },
    payload
  )
  if (obs.isDestroyed) {
    close()
  } else {
    obs.closeFunction = close
  }
}

export const create = (
  server: BasedServer,
  name: string,
  id: number,
  payload: any
): ActiveObservable => {
  if (server.activeObservablesById.has(id)) {
    return server.activeObservablesById.get(id)
  }

  const obs: ActiveObservable = {
    payload,
    clients: new Set(),
    workers: new Set(),
    id,
    name,
    isDestroyed: false,
  }

  if (!server.activeObservables[name]) {
    server.activeObservables[name] = new Map()
  }

  server.activeObservables[name].set(id, obs)
  server.activeObservablesById.set(id, obs)

  initFunction(server, id)

  return obs
}
