import { ActiveObservable } from './types.js'
import { start } from './start/index.js'
import { hasObs } from './get.js'
import { FunctionHandler } from '../types.js'
import { BasedRoute, Session } from '@based/functions'

export const createObs: FunctionHandler<Session, BasedRoute<'query'>> = (
  props,
  spec,
): ActiveObservable => {
  const obs = createObsNoStart(props, spec)
  // pass spec
  start(props.server, props.id)
  return obs
}

export const createObsNoStart: FunctionHandler<Session, BasedRoute<'query'>> = (
  { server, id, payload, route, attachedCtx },
  spec,
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
    route,
    isDestroyed: false,
    startId: 0,
    timeTillDestroy: null,
    attachedCtx,
  }
  if (!server.activeObservables[route.name]) {
    server.activeObservables[route.name] = new Map()
  }
  server.activeObservables[route.name].set(id, obs)
  server.activeObservablesById.set(id, obs)
  return obs
}
