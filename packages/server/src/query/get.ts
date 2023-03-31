import { ActiveObservable } from './types'
import { BasedServer } from '../server'
import { extendCache } from './extendCache'

export const getObsAndStopRemove = (
  server: BasedServer,
  id: number
): ActiveObservable => {
  const obs = server.activeObservablesById.get(id)
  extendCache(obs)
  return obs
}

export const hasObs = (server: BasedServer, id: number): Boolean => {
  return server.activeObservablesById.has(id)
}
