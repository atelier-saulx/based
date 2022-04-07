import { BasedClient } from '..'
import { RequestTypes, SubscribeMessage } from '@based/types'
import { addToQueue } from '../queue'
import { generateSubscriptionId } from './generateId'

export const addSubscriber = (
  client: BasedClient,
  query: any,
  onData: (data: any, checksum: number) => void,
  onInitial?: (
    err: Error | null,
    subscriptionId?: number,
    subscriberId?: number,
    data?: any,
    isAuthError?: boolean
  ) => void,
  onError?: (err: Error) => void,
  subscriptionId?: number,
  name?: string
): [number, number] => {
  if (!subscriptionId) {
    subscriptionId = generateSubscriptionId(query, name)
  }
  let subscription = client.subscriptions[subscriptionId]
  const cache = client.cache[subscriptionId]
  let subscriberId: number
  if (subscription) {
    subscriberId = ++subscription.cnt

    let onlyGets = true
    for (const k in subscription.subscribers) {
      const s = subscription.subscribers[k]
      if (s.onData) {
        onlyGets = false
        break
      }
    }

    subscription.subscribers[subscriberId] = {
      onError,
      onData,
      onInitial,
    }

    if (onlyGets) {
      // FIX THIS CASE
      // need to check if its connected and if the thing is either in the queue or awaiting response
      for (let i = 0; i < client.subscriptionQueue.length; i++) {
        const [type, id] = client.subscriptionQueue[i]
        if (type === RequestTypes.GetSubscription && id === subscriptionId) {
          client.subscriptionQueue.splice(i, 1)
          i--
        }
      }

      const payload: SubscribeMessage = [
        RequestTypes.Subscription,
        subscriptionId,
        query,
      ]
      if (cache) {
        payload.push(cache.checksum)
        payload.push(2)
      }
      if (name) {
        if (!cache) {
          payload.push(0, 2)
        }
        payload.push(name)
      }
      addToQueue(client, payload)
    }
  } else {
    subscriberId = 1
    subscription = client.subscriptions[subscriptionId] = {
      query,
      cnt: 1,
      name,
      subscribers: {
        1: {
          onError,
          onData,
          onInitial,
        },
      },
    }
    let dontSend = false
    let includeReply = false
    let subsMsg
    for (let i = 0; i < client.subscriptionQueue.length; i++) {
      const [type, id, , checksum] = client.subscriptionQueue[i]
      if (
        (type === RequestTypes.Unsubscribe ||
          type === RequestTypes.SendSubscriptionData ||
          type === RequestTypes.GetSubscription) && // DO STILL NEED A REPLY THAT IT DID NOT CHANGE
        id === subscriptionId
      ) {
        if (type === RequestTypes.GetSubscription) {
          includeReply = true
        }
        if (subsMsg) {
          subsMsg[4] = 2
        }
        client.subscriptionQueue.splice(i, 1)
        i--
      } else if (type === RequestTypes.Subscription && id === subscriptionId) {
        dontSend = true

        subsMsg = client.subscriptionQueue[i]
        if (checksum !== cache.checksum) {
          subsMsg[3] = cache.checksum
        }
        if (!subsMsg[4] && includeReply) {
          subsMsg[4] = 2
        }
      }
    }
    if (!dontSend) {
      const payload: SubscribeMessage = [
        RequestTypes.Subscription,
        subscriptionId,
        query,
      ]
      if (cache) {
        payload.push(cache.checksum)
        if (includeReply) {
          payload.push(2)
        }
      }
      if (name) {
        if (!cache) {
          payload.push(0, 0)
        } else if (!includeReply && cache) {
          payload.push(2)
        }
        payload.push(name)
      }

      addToQueue(client, payload)
    }
  }
  if (cache) {
    if (onInitial) {
      onInitial(null, subscriptionId, subscriberId)
      delete subscription.subscribers[subscriberId].onInitial
    }
    if (onData) {
      onData(cache.value, cache.checksum)
    }
  }
  return [subscriptionId, subscriberId]
}
