import uws from '@based/uws'
import { valueToBuffer, encodeObservableResponse } from '../protocol'
import { BasedServer } from '../server'
import { ActiveObservable, ObservableUpdateFunction } from '../types'
import { hashObjectIgnoreKeyOrder, hash } from '@saulx/hash'

export const destroy = (server: BasedServer, id: number) => {
  console.info('destroy observable!')
  // also need to send info to clients that its gone (e.g. does not exist anymore)

  // TODO: have to implement memCache here

  const obs = server.activeObservablesById.get(id)

  if (!obs) {
    console.error('Observable', id, 'does not exists')
    return
  }

  const spec = server.functions.observables[obs.name]

  if (!spec) {
    console.warn('Cannot find observable function spec!', obs.name)
    return
  }

  const memCacheTimeout =
    spec.memCacheTimeout !== undefined
      ? spec.memCacheTimeout
      : server.functions.config.memCacheTimeout

  obs.beingDestroyed = setTimeout(() => {
    console.info('memCacheit', memCacheTimeout)
    server.activeObservables[obs.name].delete(id)
    if (server.activeObservables[obs.name].size === 0) {
      delete server.activeObservables[obs.name]
    }
    server.activeObservablesById.delete(id)
    obs.isDestroyed = true
    obs.isDestroyed = true
    if (obs.closeFunction) {
      obs.closeFunction()
    }
  }, memCacheTimeout)
}

export const subscribe = (
  server: BasedServer,
  id: number,
  checksum: number,
  ws: uws.WebSocket
) => {
  const obs = server.activeObservablesById.get(id)
  ws.obs.add(id)
  if (obs.beingDestroyed) {
    clearTimeout(obs.beingDestroyed)
    obs.beingDestroyed = null
  }
  obs.clients.add(ws.id)
  if (obs.cache && obs.checksum !== checksum) {
    ws.send(obs.cache, true, false)
  }
}

export const unsubscribe = (
  server: BasedServer,
  id: number,
  ws: uws.WebSocket
) => {
  if (!ws.obs.has(id)) {
    return
  }

  const obs = server.activeObservablesById.get(id)
  ws.obs.delete(id)

  if (!obs) {
    return
  }

  obs.clients.delete(ws.id)

  if (obs.clients.size === 0) {
    destroy(server, id)
  }
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

  const update: ObservableUpdateFunction = (
    data: any,
    checksum?: number,
    diff?: any,
    fromChecksum?: number
  ) => {
    if (diff && fromChecksum) {
      // fix later
    }

    if (checksum === undefined) {
      if (data === undefined) {
        checksum = 0
      } else {
        // do something
        if (typeof data === 'object' && data !== null) {
          checksum = hashObjectIgnoreKeyOrder(data)
        } else {
          checksum = hash(data)
        }
      }
    }
    if (checksum !== obs.checksum) {
      const buff = valueToBuffer(data)
      const encodedData = encodeObservableResponse(id, checksum, buff)
      obs.cache = encodedData
      obs.checksum = checksum
      server.uwsApp.publish(String(id), encodedData, true, false)
      if (obs.onNextData) {
        const setObs = obs.onNextData
        delete obs.onNextData
        setTimeout(() => {
          setObs.forEach((fn) => fn())
        }, 0)
      }
    }
  }

  try {
    const close = await spec.function(obs.payload, update)
    if (obs.isDestroyed) {
      close()
    } else {
      obs.closeFunction = close
    }
  } catch (err) {
    console.error('Error starting', err)
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
