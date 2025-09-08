import { BasedServer } from '../server.js'
import { ActiveObservable, AttachedCtx } from './types.js'
import { start } from './start/index.js'
import { hasObs } from './get.js'

export const createObs = (
  server: BasedServer,
  name: string,
  id: number,
  payload: any,
  noStart?: boolean,
  attachCtx?: AttachedCtx,
): ActiveObservable => {
  if (hasObs(server, id)) {
    const msg = `Already has observable ${name} ${id}`
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
    startId: 0,
    timeTillDestroy: null,
    attachCtx,
  }

  if (!server.activeObservables[name]) {
    server.activeObservables[name] = new Map()
  }

  // if (attachCtx) {
  //   // needs a count prob...
  //   server.activeCtxObservables.set(id, { config: attachCtx.config, count: 0 })
  // }

  server.activeObservables[name].set(id, obs)
  server.activeObservablesById.set(id, obs)

  if (noStart) {
    return obs
  }

  start(server, id)
  return obs
}
