import { BasedServer } from '../server.js'
import { cleanUpObs } from './cleanup.js'
import { ActiveObservable } from './types.js'
import { isBasedFunctionConfig } from '@based/functions'

export const updateDestroyTimer = (
  server: BasedServer,
  channel: ActiveObservable,
) => {
  const spec = server.functions.specs[channel.name]
  if (!spec || !isBasedFunctionConfig('query', spec)) {
    console.warn('destroyObs - Cannot find obs function spec -', channel.name)
    return
  }
  const closeAfterIdleTime =
    spec.closeAfterIdleTime ?? server.functions.config.closeAfterIdleTime.query
  channel.timeTillDestroy = closeAfterIdleTime
  channel.closeAfterIdleTime = closeAfterIdleTime
  const closeTime = Math.round(closeAfterIdleTime / 2)

  if (closeTime < server.obsCleanupCycle) {
    server.obsCleanupCycle = closeTime
  }
}

// dont use timer just use counter to remove it over time
export const destroyObs = (server: BasedServer, id: number) => {
  const obs = server.activeObservablesById.get(id)

  if (!obs) {
    console.error('destroyObs', id, 'does not exist!')
    return
  }

  if (obs.isDestroyed) {
    console.error('obs allready destroyed', obs.name)
    return
  }

  if (
    obs.clients.size ||
    obs.functionObserveClients.size ||
    obs.onNextData?.size ||
    obs.oldClients?.size
  ) {
    if (obs.timeTillDestroy) {
      obs.timeTillDestroy = null
      console.warn(
        `Obs being destroyed while listeners are present ${obs.name} ${obs.id}`,
        obs.payload,
      )
    }
    return
  }

  if (obs.timeTillDestroy === null) {
    updateDestroyTimer(server, obs)
    cleanUpObs(server)
  }
}
