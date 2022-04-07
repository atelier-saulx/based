import { BasedClient } from '..'
import {
  RequestTypes,
  SendSubscriptionGetDataMessage,
  GenericObject,
} from '@based/types'
import { addToQueue } from '../queue'
import { generateSubscriptionId } from './generateId'

export const addGetSubscriber = (
  client: BasedClient,
  query: any,
  onInitial: (
    err: Error | null,
    subscriptionId?: number,
    subscriberId?: number,
    data?: GenericObject
  ) => void,
  subscriptionId?: number,
  name?: string
) => {
  if (!subscriptionId) {
    subscriptionId = generateSubscriptionId(query, name)
  }
  let subscription = client.subscriptions[subscriptionId]
  const cache = client.cache[subscriptionId]
  if (subscription) {
    if (subscription.authError) {
      if (!client.beingAuth) {
        onInitial(subscription.authError.error, subscriptionId, 0)
      } else {
        const subscriberId = ++subscription.cnt
        subscription.subscribers[subscriberId] = {
          onInitial,
        }
      }
    } else if (cache) {
      onInitial(null, subscriptionId, 0, cache.value)
    } else {
      const subscriberId = ++subscription.cnt
      subscription.subscribers[subscriberId] = {
        onInitial,
      }
    }
  } else {
    subscription = client.subscriptions[subscriptionId] = {
      query,
      cnt: 1,
      name,
      subscribers: {
        1: {
          onInitial,
        },
      },
    }
    let dontSend
    for (let i = 0; i < client.subscriptionQueue.length; i++) {
      const [type, id, , checksum] = client.subscriptionQueue[i]
      if (
        (type === RequestTypes.Unsubscribe ||
          type === RequestTypes.SendSubscriptionData) &&
        id === subscriptionId
      ) {
        client.subscriptionQueue.splice(i, 1)
        i--
      } else if (
        (type === RequestTypes.Subscription ||
          type === RequestTypes.GetSubscription) &&
        id === subscriptionId
      ) {
        dontSend = true
        if (type === RequestTypes.Subscription) {
          if (checksum !== cache.checksum) {
            client.subscriptionQueue[i][3] = cache.checksum
          }
          client.subscriptionQueue[i][4] = 2
        }
      }
    }
    if (!dontSend) {
      const payload: SendSubscriptionGetDataMessage = [
        RequestTypes.GetSubscription,
        subscriptionId,
        query,
      ]
      if (cache) {
        payload.push(cache.checksum)
      }
      if (name) {
        if (!cache) {
          payload.push(0)
        }
        payload.push(name)
      }
      addToQueue(client, payload)
    }
  }
}
