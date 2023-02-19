import { ActiveChannel } from './types'
import { BasedServer } from '../server'
import { extendChannel } from './extend'

export const getChannel = (server: BasedServer, id: number): ActiveChannel => {
  const obs = server.activeChannelsById.get(id)
  extendChannel(obs)
  return obs
}

export const hasChannel = (server: BasedServer, id: number): Boolean => {
  return server.activeChannelsById.has(id)
}
