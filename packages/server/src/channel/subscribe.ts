import { BasedServer } from '../server'
import { getChannelAndStopRemove } from './get'
import {
  WebSocketSession,
  Context,
  ChannelMessageFunction,
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
  if (!channel.isActive) {
    startChannel(server, id)
  }
}

export const subscribeChannelFunction = (
  server: BasedServer,
  id: number,
  update: ChannelMessageFunction
) => {
  const channel = getChannelAndStopRemove(server, id)
  channel.functionChannelClients.add(update)
  if (!channel.isActive) {
    startChannel(server, id)
  }
}
