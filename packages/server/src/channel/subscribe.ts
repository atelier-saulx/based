import { BasedServer } from '../server'
import { getChannel } from './get'
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
  const obs = getChannel(server, id)
  ctx.session.obs.add(id)
  obs.clients.add(ctx.session.id)
}

export const subscribeChannelFunction = (
  server: BasedServer,
  id: number,
  update: ChannelMessageFunction
) => {
  const obs = getChannel(server, id)
  obs.functionChannelClients.add(update)
}
