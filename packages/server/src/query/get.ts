import { ActiveObservable } from './types.js'
import { BasedServer } from '../server.js'
import { extendCache } from './extendCache.js'

export const getObsAndStopRemove = (
  server: BasedServer,
  id: number,
): ActiveObservable => {
  const obs = server.activeObservablesById.get(id)
  extendCache(obs)
  return obs
}

export const hasObs = (server: BasedServer, id: number): Boolean => {
  return server.activeObservablesById.has(id)
}
