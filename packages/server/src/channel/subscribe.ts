import { BasedServer } from '../server'
import { getChannelAndStopRemove } from './get'
import {
  WebSocketSession,
  Context,
  ChannelMessageFunctionInternal,
} from '@based/functions'
import { startChannel } from './start'

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
  channel.functionChannelClients.add(update)
  if (!channel.isActive && !channel.doesNotExist) {
    startChannel(server, id)
  }
}
