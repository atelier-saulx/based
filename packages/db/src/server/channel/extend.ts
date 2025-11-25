import { ActiveChannel } from './types.js'
import { BasedServer } from '../server.js'

export const stopRemoveChannel = (channel: ActiveChannel) => {
  if (channel.timeTillDestroy) {
    channel.timeTillDestroy = null
  }
}

export const extendChannel = (_server: BasedServer, channel: ActiveChannel) => {
  if (channel.closeAfterIdleTime && channel.timeTillDestroy !== null) {
    channel.timeTillDestroy = channel.closeAfterIdleTime
  }
}
