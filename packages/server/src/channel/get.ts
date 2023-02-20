import { ActiveChannel } from './types'
import { BasedServer } from '../server'
import { stopRemoveChannel } from './extend'

export const getChannelAndStopRemove = (
  server: BasedServer,
  id: number
): ActiveChannel => {
  const obs = server.activeChannelsById.get(id)
  stopRemoveChannel(obs)
  return obs
}

export const hasChannel = (server: BasedServer, id: number): Boolean => {
  return server.activeChannelsById.has(id)
}
