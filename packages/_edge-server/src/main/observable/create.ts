import { BasedServer } from '../server'
import { ActiveObservable } from '../../types'
import { initFunction } from './init'
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
  // console.info(`   Create observable ${name} ${id}`, payload)

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
