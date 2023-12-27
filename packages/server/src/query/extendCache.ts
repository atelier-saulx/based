import { ActiveObservable } from './types.js'

export const extendCache = (obs: ActiveObservable) => {
  if (obs.timeTillDestroy) {
    obs.timeTillDestroy = null
  }
}
