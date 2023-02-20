import { ActiveChannel } from './types'
import { BasedServer } from '../server'

export const stopRemoveChannel = (channel: ActiveChannel) => {
  if (channel.timeTillDestroy) {
    channel.timeTillDestroy = null
  }
}

export const extendChannel = (server: BasedServer, channel: ActiveChannel) => {
  if (channel.closeAfterIdleTime && channel.timeTillDestroy !== null) {
    channel.timeTillDestroy = channel.closeAfterIdleTime
  }
}
