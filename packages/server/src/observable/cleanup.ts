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
      // const d = Date.now()
      // let cnt = 0
      server.obsCleanTimeout = null
      let keepRunning = false
      let shortestCycleTime: number
      server.activeObservablesById.forEach((obs) => {
        if (obs.timeTillDestroy !== null) {
          obs.timeTillDestroy -= cycleTime
          if (obs.timeTillDestroy < 1) {
            // cnt++
            destroyObs(server, obs)
          } else {
            if (
              shortestCycleTime === undefined ||
              obs.timeTillDestroy < shortestCycleTime
            ) {
              shortestCycleTime = obs.timeTillDestroy
            }
            keepRunning = true
          }
        }
      })
      if (keepRunning) {
        server.obsCleanupCycle = shortestCycleTime
        cleanUpObs(server)
      }
      // console.info(
      //   'Cleanup time',
      //   cycleTime,
      //   'new',
      //   server.obsCleanupCycle,
      //   Date.now() - d,
      //   'ms',
      //   cnt,
      //   'obs cleaned up'
      // )
    }, cycleTime)
  }
}
