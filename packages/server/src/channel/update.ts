import { ActiveChannel } from './types'
import { valueToBuffer, encodeChannelMessage } from '../protocol'
import { BasedServer } from '../server'

export const updateChannelListener = (
  server: BasedServer,
  obs: ActiveChannel,
  msg: any
) => {
  const data = encodeChannelMessage(obs.id, valueToBuffer(msg))
  if (obs.clients.size) {
    server.uwsApp.publish(String(obs.id), data, true, false)
  }
  if (obs.functionChannelClients.size) {
    obs.functionChannelClients.forEach((fnUpdate) => {
      fnUpdate(msg)
    })
  }
}
