import { BasedServer } from '../server'

export const destroyObs = (server: BasedServer, id: number) => {
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
      console.warn(
        `Obs being destroyed while clients/workers/getListeners are present ${obs.name} ${obs.id}`,
        obs.payload
      )
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
