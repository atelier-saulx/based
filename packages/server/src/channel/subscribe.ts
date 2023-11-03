import { BasedServer } from '../server.js'
import { getChannelAndStopRemove } from './get.js'
import {
  WebSocketSession,
  Context,
  ChannelMessageFunctionInternal,
} from '@based/functions'
import { startChannel } from './start.js'

export const subscribeChannel = (
  server: BasedServer,
  id: number,
  ctx: Context<WebSocketSession>
) => {
  const session = ctx.session
  if (!session) {
    return
  }

  ctx.session.ws.subscribe(String(id))
  const channel = getChannelAndStopRemove(server, id)

  if (server.channelEvents) {
    server.channelEvents.subscribe(channel, ctx)
  }

  session.obs.add(id)
  channel.clients.add(session.id)
  if (!channel.isActive && !channel.doesNotExist) {
    startChannel(server, id)
  }
}

export const subscribeChannelFunction = (
  server: BasedServer,
  id: number,
  update: ChannelMessageFunctionInternal
) => {
  const channel = getChannelAndStopRemove(server, id)

  if (channel.functionChannelClients.add(update)) {
    if (server.channelEvents) {
      server.channelEvents.subscribe(channel)
    }
  }
  if (!channel.isActive && !channel.doesNotExist) {
    startChannel(server, id)
  }
}
