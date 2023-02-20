import { BasedServer } from '../server'
import { getChannelAndStopRemove } from './get'
import {
  WebSocketSession,
  Context,
  ChannelMessageFunction,
} from '@based/functions'

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
}

export const subscribeChannelFunction = (
  server: BasedServer,
  id: number,
  update: ChannelMessageFunction
) => getChannelAndStopRemove(server, id).functionChannelClients.add(update)
