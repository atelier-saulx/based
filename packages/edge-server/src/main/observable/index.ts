import { BasedServer } from '../server'
import {
  ActiveObservable,
  ObservableDummyClient,
  WebsocketClient,
  WorkerClient,
} from '../../types'
import { encodeErrorResponse, updateId, valueToBuffer } from '../../protocol'
import { createError } from '../error'
import { sendError } from '../incoming/message/send'

export const destroy = (server: BasedServer, id: number) => {
  const obs = server.activeObservablesById.get(id)

  if (!obs) {
    console.error('Observable', id, 'does not exists')
    return
  }

  if (obs.isDestroyed) {
    console.error('Obs allready destroyed', obs.name)
    return
  }

  if (obs.clients.size || obs.workers.size || obs.onNextData?.size) {
    if (obs.beingDestroyed) {
      console.error('OBS BEING DESTROYED BUT HAS THINGS...')
    }
    return
  }

  const spec = server.functions.observables[obs.name]

  if (!spec) {
    console.warn('Cannot find observable function spec!', obs.name)
    return
  }

  if (!obs.beingDestroyed) {
    const memCacheTimeout =
      spec.memCacheTimeout ?? server.functions.config.memCacheTimeout

    obs.beingDestroyed = setTimeout(() => {
      console.error('--> DESTROY OBS', id, obs.name)
      obs.beingDestroyed = null
      if (!server.activeObservables[obs.name]) {
        console.info('Trying to destroy a removed observable function')
        server.activeObservablesById.delete(id)
        return
      }
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

  if (obs.error) {
    sendError(server, client, obs.error.code, {
      err: obs.error,
      observableId: id,
      route: {
        name: obs.name,
      },
    })
    return
  }

  if (obs.cache && obs.checksum !== checksum) {
    if (obs.diffCache && obs.previousChecksum === checksum) {
      if (obs.reusedCache) {
        const prevId = updateId(obs.diffCache, id)
        client.ws.send(obs.diffCache, true, false)
        obs.diffCache.set(prevId, 4)
      } else {
        client.ws.send(obs.diffCache, true, false)
      }
    } else {
      // and for this
      if (obs.reusedCache) {
        const prevId = updateId(obs.cache, id)
        client.ws.send(obs.cache, true, false)
        obs.cache.set(prevId, 4)
      } else {
        client.ws.send(obs.cache, true, false)
      }
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
  if (obs.beingDestroyed) {
    clearTimeout(obs.beingDestroyed)
    obs.beingDestroyed = null
  }
  obs.workers.add(client.worker)
  if (obs.cache && obs.checksum !== checksum) {
    client.worker.worker.postMessage({
      type: 8,
      id,
      checksum: obs.checksum,
      data: obs.cache,
      isDeflate: obs.isDeflate,
      diff: obs.diffCache,
      previousChecksum: obs.previousChecksum,
      reusedCache: obs.reusedCache,
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

const dummyClient: ObservableDummyClient = {
  isDummy: true,
  context: {
    query: '',
    ip: '',
    id: -1,
    ua: '',
    method: 'dummy',
    headers: {},
  },
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
    // @ts-ignore
    spec,
    id,
    // add isDeflate for http
    (err) => {
      // keep initialization error?
      obs.error = err
      delete obs.cache
      delete obs.diffCache
      delete obs.checksum
      delete obs.previousChecksum

      obs.isDeflate = false
      obs.reusedCache = false

      const errorData = createError(server, dummyClient, err.code, {
        err,
        observableId: id,
        route: {
          name: obs.name,
        },
      })

      if (obs.clients.size) {
        server.uwsApp.publish(
          String(id),
          encodeErrorResponse(valueToBuffer(errorData)),
          true,
          false
        )
      }

      if (obs.workers.size) {
        obs.workers.forEach((w) => {
          w.worker.postMessage({
            type: 8,
            id,
            err,
          })
        })
      }

      if (obs.onNextData) {
        const onNextData = obs.onNextData
        delete obs.onNextData
        onNextData.forEach((fn) => fn(err))
      }
    },
    (encodedDiffData, encodedData, checksum, isDeflate, reusedCache) => {
      obs.error = null
      obs.previousChecksum = obs.checksum
      obs.checksum = checksum
      obs.cache = encodedData
      obs.isDeflate = isDeflate
      obs.reusedCache = reusedCache || false

      if (encodedDiffData) {
        obs.diffCache = encodedDiffData
      }

      let prevId: Uint8Array
      let prevDiffId: Uint8Array

      if (obs.clients.size) {
        if (encodedDiffData) {
          if (reusedCache) {
            prevDiffId = updateId(encodedDiffData, id)
          }
          server.uwsApp.publish(String(id), encodedDiffData, true, false)
        } else {
          if (reusedCache) {
            prevId = updateId(encodedData, id)
          }
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
            reusedCache: obs.reusedCache,
          })
        })
      }

      if (obs.onNextData) {
        const onNextData = obs.onNextData
        delete obs.onNextData
        onNextData.forEach((fn) => fn())
      }

      if (prevDiffId) {
        encodedDiffData.set(prevDiffId, 4)
      }
      if (prevId) {
        encodedData.set(prevId, 4)
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
    console.warn('Allready has observable', id)
    throw new Error('WRONG')
    return server.activeObservablesById.get(id)
  }
  console.info('CREATE OBSERVABLE', name, id, payload)

  const obs: ActiveObservable = {
    payload,
    reusedCache: false,
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
