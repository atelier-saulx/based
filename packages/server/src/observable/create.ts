import { BasedServer } from '../server'
import { ActiveObservable } from './types'
import { start } from './start'
import { hasObs } from './get'

export const createObs = (
  server: BasedServer,
  name: string,
  id: number,
  payload: any
): ActiveObservable => {
  if (hasObs(server, id)) {
    const msg = `Allready has observable ${name} ${id}`
    console.error(msg)
    throw new Error(msg)
  }

  const obs: ActiveObservable = {
    payload,
    reusedCache: false,
    clients: new Set(),
    functionObserveClients: new Set(),
    id,
    name,
    isDestroyed: false,
  }

  if (!server.activeObservables[name]) {
    server.activeObservables[name] = new Map()
  }

  server.activeObservables[name].set(id, obs)
  server.activeObservablesById.set(id, obs)

  start(server, id)

  return obs
}
