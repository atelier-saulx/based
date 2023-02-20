import { ActiveChannel } from './types'
import { destroyChannel } from './destroy'
import { BasedServer } from '../server'

export const stopRemoveChannel = (channel: ActiveChannel) => {
  if (channel.beingDestroyed) {
    clearTimeout(channel.beingDestroyed)
    channel.beingDestroyed = null
  }
}

export const extendChannel = (server: BasedServer, channel: ActiveChannel) => {
  // TODO: optmize this
  stopRemoveChannel(channel)
  destroyChannel(server, channel.id)
}
