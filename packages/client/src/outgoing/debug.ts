import { BasedClient } from '..'
import { ChannelQueueItem } from '../types/channel'

export const debugChannel = (
  client: BasedClient,
  id: number,
  o: ChannelQueueItem
) => {
  client.emit('debug', {
    direction: 'outgoing',
    type:
      o[0] === 7
        ? 'unsubscribeChannel'
        : o[0] === 6
        ? 'registerChannelId'
        : 'subscribeChannel',
    id,
    ...(o[0] === 7
      ? undefined
      : o[2]
      ? { name: o[1], payload: o[2] }
      : { name: o[1] }),
  })
}
