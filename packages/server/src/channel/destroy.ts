import { isChannelFunctionSpec } from '../functions'
import { BasedServer } from '../server'

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
    if (channel.beingDestroyed) {
      console.warn(
        `Channel being destroyed while listeners are present ${channel.name} ${channel.id}`,
        channel.payload
      )
    }

    return
  }

  const spec = server.functions.specs[channel.name]

  if (!spec || !isChannelFunctionSpec(spec)) {
    console.warn('Cannot find channel function spec!', channel.name)
    return
  }

  if (!channel.beingDestroyed) {
    const closeAfterIdleTime =
      spec.closeAfterIdleTime ??
      server.functions.config.closeAfterIdleTime.channel
    channel.beingDestroyed = setTimeout(() => {
      channel.beingDestroyed = null
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
    }, closeAfterIdleTime) // later
  }
}
