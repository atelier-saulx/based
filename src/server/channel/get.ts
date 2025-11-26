import { ActiveChannel } from './types.js'
import { BasedServer } from '../server.js'
import { stopRemoveChannel } from './extend.js'

export const getChannelAndStopRemove = (
  server: BasedServer,
  id: number,
): ActiveChannel => {
  const obs = server.activeChannelsById.get(id)!
  stopRemoveChannel(obs)
  return obs
}

export const hasChannel = (server: BasedServer, id: number): Boolean => {
  return server.activeChannelsById.has(id)
}
