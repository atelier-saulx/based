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
  if (!ctx.session) {
    return
  }
  ctx.session.subscribe(String(id))
  const channel = getChannelAndStopRemove(server, id)
  ctx.session.obs.add(id)
  channel.clients.add(ctx.session.id)
}

export const subscribeChannelFunction = (
  server: BasedServer,
  id: number,
  update: ChannelMessageFunction
) => getChannelAndStopRemove(server, id).functionChannelClients.add(update)
