import { BasedClient } from '..'
import {
  FunctionQueueItem,
  GetObserveQueueItem,
  ObserveQueueItem,
} from '../types'
import { ChannelPublishQueueItem, ChannelQueueItem } from '../types/channel'
import { getTargetInfo } from '../getTargetInfo'

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
    target: {
      id,
      ...(o[0] === 7
        ? undefined
        : o[2]
        ? { name: o[1], payload: o[2] }
        : { name: o[1] }),
    },
  })
}

export const debugGet = (
  client: BasedClient,
  id: number,
  o: GetObserveQueueItem
) => {
  client.emit('debug', {
    direction: 'outgoing',
    type: 'get',
    target: { id, name: o[1], payload: o[3] },
    checksum: o[2],
  })
}

export const debugObserve = (
  client: BasedClient,
  id: number,
  o: ObserveQueueItem
) => {
  client.emit('debug', {
    direction: 'outgoing',
    type: o[0] === 2 ? 'unsubscribe' : 'subscribe',
    target:
      o[0] === 2
        ? {
            id,
          }
        : {
            id,
            ...(o[3]
              ? { name: o[1], checksum: o[2], payload: o[3] }
              : { name: o[1], checksum: o[2] }),
          },
  })
}

export const debugFunction = (client: BasedClient, f: FunctionQueueItem) => {
  client.emit('debug', {
    direction: 'outgoing',
    type: 'function',
    target: {
      name: f[1],
    },
    ...(f[2] ? { payload: f[2] } : undefined),
  })
}

export const debugPublish = (
  client: BasedClient,
  f: ChannelPublishQueueItem
) => {
  client.emit('debug', {
    direction: 'outgoing',
    type: 'publishChannel',
    target: getTargetInfo(client, f[0], 'channel'),
    payload: f[1],
  })
}
