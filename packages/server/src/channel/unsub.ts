import { BasedServer } from '../server.js'
import {
  WebSocketSession,
  Context,
  ChannelMessageFunction,
} from '@based/functions'
import { destroyChannel } from './destroy.js'

export const unsubscribeFunction = (
  server: BasedServer,
  id: number,
  update: ChannelMessageFunction
): true | void => {
  const channel = server.activeChannelsById.get(id)
  if (!channel) {
    return
  }
  if (channel.functionChannelClients.delete(update)) {
    if (server.channelEvents) {
      server.channelEvents.unsubscribe(channel)
    }
    destroyChannel(server, id)
    return true
  }
}

export const unsubscribeChannel = (
  server: BasedServer,
  id: number,
  ctx: Context<WebSocketSession>
): true | void => {
  const session = ctx.session
  if (!session) {
    return
  }
  if (!session.obs.has(id)) {
    return
  }
  ctx.session.ws.unsubscribe(String(id))
  const channel = server.activeChannelsById.get(id)
  session.obs.delete(id)
  if (!channel) {
    return
  }
  if (channel.clients.delete(session.id)) {
    if (server.channelEvents) {
      server.channelEvents.unsubscribe(channel, ctx)
    }
    destroyChannel(server, id)
    return true
  }
}

export const unsubscribeChannelIgnoreClient = (
  server: BasedServer,
  id: number,
  ctx: Context<WebSocketSession>
) => {
  const session = ctx.session
  if (!session) {
    return
  }
  const channel = server.activeChannelsById.get(id)
  if (!channel) {
    return
  }

  if (channel.clients.delete(session.id) && server.channelEvents) {
    server.channelEvents.unsubscribe(channel, ctx)
  }

  destroyChannel(server, id)
}
