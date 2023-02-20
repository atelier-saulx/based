import { BasedServer } from '../server'
import { isChannelFunctionSpec } from '../functions'
import { updateChannelListener } from './update'

export const startChannel = (
  server: BasedServer,
  id: number,
  fromInstall?: boolean
) => {
  const channel = server.activeChannelsById.get(id)

  if (channel.closeFunction) {
    channel.closeFunction()
    delete channel.closeFunction
  }

  const spec = server.functions.specs[channel.name]

  const payload = channel.payload

  if (!spec || !isChannelFunctionSpec(spec)) {
    console.warn(
      'Start channel - cannot find channel function spec',
      channel.name
    )
    return
  }

  if (!fromInstall || channel.isActive) {
    channel.isActive = true
    try {
      channel.closeFunction = spec.function(server.client, payload, id, (msg) =>
        updateChannelListener(server, channel, msg)
      )
    } catch (err) {}
  }
}
