import { ActiveObservable } from './types'

export const extendCache = (obs: ActiveObservable) => {
  if (obs.timeTillDestroy) {
    obs.timeTillDestroy = null
  }
}
