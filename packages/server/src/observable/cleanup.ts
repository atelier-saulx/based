import { BasedServer } from '../server'
import { ActiveObservable } from './types'

// TODO: maybe share between obs and channel
const destroyObs = (server: BasedServer, obs: ActiveObservable) => {
  const id = obs.id
  obs.timeTillDestroy = null
  if (!server.activeObservables[obs.name]) {
    console.info('Trying to destroy a removed query function')
    server.activeObservablesById.delete(id)
    return
  }
  server.activeObservables[obs.name].delete(id)
  if (server.activeObservables[obs.name].size === 0) {
    delete server.activeObservables[obs.name]
  }
  server.activeObservablesById.delete(id)
  obs.isDestroyed = true
  if (obs.closeFunction) {
    obs.closeFunction()
  }
}

export const cleanUpObs = (server: BasedServer) => {
  if (!server.obsCleanTimeout) {
    const cycleTime = Math.max(server.obsCleanupCycle, 500)
    server.obsCleanTimeout = setTimeout(() => {
      server.obsCleanTimeout = null
      let keepRunning = false
      let shortestCycleTime = 0
      server.activeObservablesById.forEach((obs) => {
        if (obs.timeTillDestroy !== null) {
          obs.timeTillDestroy -= cycleTime
          if (obs.timeTillDestroy < 1) {
            destroyObs(server, obs)
          } else {
            if (obs.timeTillDestroy < shortestCycleTime) {
              shortestCycleTime = obs.timeTillDestroy
            }
            keepRunning = true
          }
        }
      })
      if (keepRunning) {
        server.obsCleanupCycle = Math.round(shortestCycleTime / 2)
        cleanUpObs(server)
      }
    }, cycleTime)
  }
}
