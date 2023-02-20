import { BasedServer } from '../server'
import { ActiveChannel } from './types'
import { startChannel } from './start'
import { hasChannel } from './get'

export const createChannel = (
  server: BasedServer,
  name: string,
  id: number,
  payload: any,
  noStart?: boolean
): ActiveChannel => {
  if (hasChannel(server, id)) {
    const msg = `Allready has channel ${name} ${id}`
    console.error(msg)
    throw new Error(msg)
  }

  const channel: ActiveChannel = {
    payload,
    clients: new Set(),
    functionChannelClients: new Set(),
    id,
    name,
    isDestroyed: false,
    isActive: false,
    timeTillDestroy: null,
  }

  if (!server.activeChannels[name]) {
    server.activeChannels[name] = new Map()
  }

  server.activeChannels[name].set(id, channel)
  server.activeChannelsById.set(id, channel)

  if (!noStart) {
    startChannel(server, id)
  }
  return channel
}
