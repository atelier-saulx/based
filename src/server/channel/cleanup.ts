import { BasedServer } from '../server.js'
import { ActiveChannel } from './types.js'

const destroyChannel = (server: BasedServer, channel: ActiveChannel) => {
  const id = channel.id
  channel.timeTillDestroy = null
  if (!server.activeChannels[channel.name]) {
    console.info('Trying to destroy a removed channel function')
    server.activeChannelsById.delete(id)
    return
  }
  server.activeChannels[channel.name].delete(id)
  if (server.activeChannels[channel.name].size === 0) {
    delete server.activeChannels[channel.name]
  }
  server.activeChannelsById.delete(id)
  channel.isDestroyed = true
  if (channel.closeFunction) {
    channel.isActive = false
    channel.closeFunction()
  }
}

export const cleanUpChannels = (server: BasedServer) => {
  if (!server.channelCleanTimeout) {
    const cycleTime = Math.max(server.channelCleanupCycle, 500)
    server.channelCleanTimeout = setTimeout(() => {
      server.channelCleanTimeout = undefined
      let keepRunning = false
      let shortestCycleTime: number
      server.activeChannelsById.forEach((channel) => {
        if (channel.timeTillDestroy !== null) {
          channel.timeTillDestroy -= cycleTime
          if (channel.timeTillDestroy < 1) {
            destroyChannel(server, channel)
          } else {
            if (
              shortestCycleTime === undefined ||
              channel.timeTillDestroy < shortestCycleTime
            ) {
              shortestCycleTime = channel.timeTillDestroy
            }
            keepRunning = true
          }
        }
      })
      if (keepRunning) {
        server.channelCleanupCycle = Math.round(shortestCycleTime! / 2)
        cleanUpChannels(server)
      }
    }, cycleTime)
  }
}
