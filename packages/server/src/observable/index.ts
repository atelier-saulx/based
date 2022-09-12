import {
  valueToBuffer,
  encodeObservableResponse,
  encodeObservableDiffResponse,
} from '../protocol'
import { BasedServer } from '../server'
import {
  ActiveObservable,
  ObservableUpdateFunction,
  WebsocketClient,
} from '../types'
import { hashObjectIgnoreKeyOrder, hash } from '@saulx/hash'
import { deepCopy } from '@saulx/utils'
import createPatch from '@saulx/diff'

export const destroy = (server: BasedServer, id: number) => {
  // also need to send info to clients that its gone (e.g. does not exist anymore)

  // TODO: have to implement memCache here

  const obs = server.activeObservablesById.get(id)

  if (!obs) {
    console.error('Observable', id, 'does not exists')
    return
  }

  if (obs.isDestroyed) {
    return
  }

  const spec = server.functions.observables[obs.name]

  if (!spec) {
    console.warn('Cannot find observable function spec!', obs.name)
    return
  }

  const memCacheTimeout =
    spec.memCacheTimeout ?? server.functions.config.memCacheTimeout

  //   clearTimeout(obs.beingDestroyed)

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

      if (obs.cache) {
        server.cacheSize -= obs.cache.byteLength
      }

      if (obs.rawData) {
        server.cacheSize -= obs.rawDataSize
      }

      obs.isDestroyed = true
      if (obs.closeFunction) {
        obs.closeFunction()
      }
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

export const unsubscribe = (
  server: BasedServer,
  id: number,
  client: WebsocketClient
) => {
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

  obs.clients.delete(client.ws.id)

  if (obs.clients.size === 0) {
    destroy(server, id)
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
    previousChecksum?: number
  ) => {
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

      if (obs.cache) {
        server.cacheSize -= obs.cache.byteLength
      }

      if (obs.rawData) {
        server.cacheSize -= obs.rawDataSize
      }

      if (previousChecksum === undefined) {
        // if buff > 1mb then dont store deepcopy
        /*
        // also have to be aware that there is an 8byte increase
        // if ratio of diff repsonse is 75% of full just send the full
        // if (diff && previousChecksum) {
        //   fix later
        // }
        */

        if (typeof data === 'object' && data !== null) {
          if (obs.rawData) {
            diff = createPatch(obs.rawData, data)
            obs.previousChecksum = obs.checksum
          }

          obs.rawData = deepCopy(data)
          const size = buff.byteLength
          server.cacheSize += size
          obs.rawDataSize = size
        } else if (obs.rawData) {
          delete obs.rawData
          delete obs.rawDataSize
        }
      }

      // keep track globally of total mem usage
      const encodedData = encodeObservableResponse(id, checksum, buff)
      obs.cache = encodedData
      server.cacheSize += obs.cache.byteLength
      obs.checksum = checksum

      if (diff) {
        const diffBuff = valueToBuffer(diff)
        const encodedDiffData = encodeObservableDiffResponse(
          id,
          checksum,
          obs.previousChecksum,
          diffBuff
        )
        obs.diffCache = encodedDiffData
        // add to cache size
        server.uwsApp.publish(String(id), encodedDiffData, true, false)
      } else {
        server.uwsApp.publish(String(id), encodedData, true, false)
      }

      if (obs.onNextData) {
        const setObs = obs.onNextData
        delete obs.onNextData
        setObs.forEach((fn) => fn())
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
