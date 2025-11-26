import { isBasedFunctionConfig } from '../../functions/functions.js'
import { BasedServer } from '../server.js'
import { cleanUpChannels } from './cleanup.js'
import { ActiveChannel } from './types.js'

export const updateDestroyTimer = (
  server: BasedServer,
  channel: ActiveChannel,
) => {
  const spec = server.functions.specs[channel.name]
  if (spec && !isBasedFunctionConfig('channel', spec)) {
    console.error(
      'channel updateDestroyTimer - Not channel spec!',
      spec,
      channel.name,
    )
    return
  }

  const closeAfterIdleTime =
    // @ts-ignore
    spec?.closeAfterIdleTime ??
    server.functions.config.closeAfterIdleTime!.channel
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
    console.error('destroyChannel', id, 'does not exist!')
    return
  }

  if (channel.isDestroyed) {
    console.error('Channel allready destroyed', channel.name)
    return
  }

  if (
    channel.clients.size ||
    channel.functionChannelClients.size ||
    channel.oldClients?.size
  ) {
    if (channel.timeTillDestroy) {
      console.warn(
        `Channel being destroyed while listeners are present ${channel.name} ${channel.id}`,
        channel.payload,
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
