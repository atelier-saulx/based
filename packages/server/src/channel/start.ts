import { BasedServer } from '../server'
import { isChannelFunctionSpec } from '../functions'
import { updateChannelListener } from './update'

export const start = (server: BasedServer, id: number) => {
  const channel = server.activeChannelsById.get(id)

  if (channel.closeFunction) {
    channel.closeFunction()
    delete channel.closeFunction
  }

  const spec = server.functions.specs[channel.name]

  if (!spec || !isChannelFunctionSpec(spec)) {
    console.warn('Cannot find channel function spec!', channel.name)
    return
  }

  const payload = channel.channelId

  try {
    channel.closeFunction = spec.function(server.client, payload, (msg) => {
      updateChannelListener(server, channel, msg)
    })
  } catch (err) {
    if (!channel.isDestroyed) {
      console.warn('is wrong')
    }
  }
}
