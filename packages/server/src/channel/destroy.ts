import { isChannelFunctionSpec } from '../functions'
import { BasedServer } from '../server'
import { cleanUpChannels } from './cleanup'
import { ActiveChannel } from './types'

export const updateDestroyTimer = (
  server: BasedServer,
  channel: ActiveChannel
) => {
  const spec = server.functions.specs[channel.name]
  if (!spec || !isChannelFunctionSpec(spec)) {
    console.warn(
      'destroyChannel - Cannot find channel function spec -',
      channel.name
    )
    return
  }
  const closeAfterIdleTime =
    spec.closeAfterIdleTime ??
    server.functions.config.closeAfterIdleTime.channel
  channel.timeTillDestroy = closeAfterIdleTime
  channel.closeAfterIdleTime = closeAfterIdleTime
  const closeTime = Math.round(closeAfterIdleTime / 2)
  if (closeTime < server.channelCleanupCycle) {
    server.channelCleanupCycle = closeTime
  }
}

// dont use timer just use counter to remove it over time
export const destroyChannel = (server: BasedServer, id: number) => {
  const channel = server.activeChannelsById.get(id)

  if (!channel) {
    console.error('channel', id, 'does not exists')
    return
  }

  if (channel.isDestroyed) {
    console.error('Channel allready destroyed', channel.name)
    return
  }

  if (channel.clients.size || channel.functionChannelClients.size) {
    if (channel.timeTillDestroy) {
      console.warn(
        `Channel being destroyed while listeners are present ${channel.name} ${channel.id}`,
        channel.payload
      )
      channel.timeTillDestroy = null
    }
    return
  }

  if (channel.timeTillDestroy === null) {
    updateDestroyTimer(server, channel)
    cleanUpChannels(server)
  }
}
