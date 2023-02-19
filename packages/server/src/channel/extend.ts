import { ActiveChannel } from './types'

export const extendChannel = (obs: ActiveChannel) => {
  if (obs.beingDestroyed) {
    clearTimeout(obs.beingDestroyed)
    obs.beingDestroyed = null
  }
}
