import { ActiveObservable } from '../../types'

export const extendCache = (obs: ActiveObservable) => {
  if (obs.beingDestroyed) {
    clearTimeout(obs.beingDestroyed)
    obs.beingDestroyed = null
  }
}
