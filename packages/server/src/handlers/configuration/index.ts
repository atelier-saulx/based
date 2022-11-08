import { DataListener } from '../../types'
import { SharedConfigurationObservable } from './observable'
import { BasedServer } from '../..'
import Client from '../../Client'
import {
  generateSubscriptionId,
  RequestTypes,
  SendSubscriptionGetDataMessage,
  SubscribeMessage,
} from '@based/client'
import { Params } from '../../Params'

import { Subscription } from '../subscription'

export const getObservable = async (
  server: BasedServer,
  client: Client,
  [, id, payload, checksum, name]: SendSubscriptionGetDataMessage
) => {
  let subscription = server.subscriptions[id]
  if (!subscription) {
    subscription = new SharedConfigurationObservable(server, id, client)

    if (!subscription.clients[client.id]) {
      subscription.subscribe(client, checksum, 1)
    } else {
      subscription.clients[client.id][2] = 2
    }
  } else {
    return subscription
  }
}

const subscriptionExists = (
  subscription: SharedConfigurationObservable | Subscription,
  client: Client,
  allwaysSend: 0 | 1 | 2,
  checksum: number
) => {
  if (subscription.clients[client.id]) {
    if (subscription.clients[client.id][2] === 1) {
      subscription.clients[client.id][2] = 2
    } else if (subscription.clients[client.id][2] === 0 && allwaysSend === 2) {
      subscription.clients[client.id][2] = 2
    }
  } else {
    subscription.subscribe(client, checksum, allwaysSend)
  }
}

export const subscribeObservable = async (
  server: BasedServer,
  client: Client,
  [, id, _payload, checksum, allwaysSend, _name]: SubscribeMessage
) => {
  let subscription = server.subscriptions[id]

  if (!subscription) {
    subscription = new SharedConfigurationObservable(server, id, client)
    subscription.subscribe(client, checksum, allwaysSend)
  } else {
    if (subscription.clients[client.id]) {
      if (subscription.clients[client.id][2] === 1) {
        subscription.clients[client.id][2] = 2
      } else if (
        subscription.clients[client.id][2] === 0 &&
        allwaysSend === 2
      ) {
        subscription.clients[client.id][2] = 2
      }
    } else {
      subscriptionExists(
        <SharedConfigurationObservable>subscription,
        client,
        allwaysSend,
        checksum
      )
    }
  }
}

export const subscribeConfiguration = async (
  params: Params,
  dataListener: DataListener
): Promise<SharedConfigurationObservable> => {
  const id = generateSubscriptionId(null, '$configuration')
  let subscription = params.server.subscriptions[id]

  subscription = new SharedConfigurationObservable(
    params.server,
    id,
    params.user
  )

  if (subscription) {
    subscription.subscribeDataListener(
      params.user,
      dataListener,
      params.callStack ? params.callStack.join('.') : params.name
    )
    return <any>subscription
  } else {
    dataListener(null, 0, {
      type: 'ObservableDoesNotExistError',
      name: `observable $configuration`,
      message: `Observable $configuration does not exist`,
    })
  }
}
