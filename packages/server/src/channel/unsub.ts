import { BasedServer } from '../server'
import {
  WebSocketSession,
  Context,
  ChannelMessageFunction,
} from '@based/functions'
import { destroyChannel } from './destroy'

export const unsubscribeFunction = (
  server: BasedServer,
  id: number,
  update: ChannelMessageFunction
): true | void => {
  const obs = server.activeChannelsById.get(id)
  if (!obs) {
    return
  }
  if (obs.functionChannelClients.delete(update)) {
    destroyChannel(server, id)
    return true
  }
}

export const unsubscribeChannel = (
  server: BasedServer,
  id: number,
  ctx: Context<WebSocketSession>
): true | void => {
  const session = ctx.session.getUserData()
  if (!session) {
    return
  }
  if (!session.obs.has(id)) {
    return
  }
  ctx.session.unsubscribe(String(id))
  const channel = server.activeChannelsById.get(id)
  session.obs.delete(id)
  if (!channel) {
    return
  }
  if (channel.clients.delete(session.id)) {
    destroyChannel(server, id)
    return true
  }
}

export const unsubscribeChannelIgnoreClient = (
  server: BasedServer,
  id: number,
  ctx: Context<WebSocketSession>
) => {
  const session = ctx.session.getUserData()
  if (!session) {
    return
  }
  const channel = server.activeChannelsById.get(id)
  if (!channel) {
    return
  }
  channel.clients.delete(session.id)
  destroyChannel(server, id)
}
