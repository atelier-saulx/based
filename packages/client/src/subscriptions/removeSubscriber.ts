import { BasedClient } from '..'
import { RequestTypes } from '@based/types'
import { addToQueue } from '../queue'

export const removeSubscriber = (
  client: BasedClient,
  subscriptionId: number,
  subscriberId?: number
) => {
  const subscription = client.subscriptions[subscriptionId]
  if (subscription) {
    let remove = false
    if (subscriberId) {
      if (subscription.subscribers[subscriberId]) {
        delete subscription.subscribers[subscriberId]
        subscription.cnt--
        if (subscription.cnt === 0) {
          remove = true
        }
      }
    } else {
      remove = true
    }
    if (remove) {
      delete client.subscriptions[subscriptionId]
      let dontSend = false
      for (let i = 0; i < client.subscriptionQueue.length; i++) {
        const [type, id] = client.subscriptionQueue[i]
        if (type === RequestTypes.Unsubscribe && id === subscriptionId) {
          dontSend = true
        } else if (
          (type === RequestTypes.Subscription ||
            type === RequestTypes.SendSubscriptionData) &&
          id === subscriptionId
        ) {
          client.subscriptionQueue.splice(i, 1)
          i--
        }
      }
      if (!dontSend) {
        addToQueue(client, [RequestTypes.Unsubscribe, subscriptionId])
      }
    }
  }
}
