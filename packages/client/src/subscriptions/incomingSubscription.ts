import { BasedClient } from '..'
import { SubscriptionData } from '@based/types'
import createError from '../createError'
import { removeSubscriber } from './removeSubscriber'

export const incomingSubscription = (
  client: BasedClient,
  data: SubscriptionData
) => {
  const [, id, value, checksum, err] = data
  const subscription = client.subscriptions[id]
  if (subscription) {
    const previousChecksum = client.cache[id] && client.cache[id].checksum
    if (err) {
      const error = createError(err)

      if (err.auth) {
        // add auth
        subscription.authError = {
          token: client.token,
          error,
        }
        // console.error(error)
      }

      for (const subscriberId in subscription.subscribers) {
        const subscriber = subscription.subscribers[subscriberId]

        if (subscriber.onInitial) {
          if (!err.auth) {
            subscriber.onInitial(error, Number(id), Number(subscriberId))
            delete subscriber.onInitial
            removeSubscriber(client, id, Number(subscriberId))
          } else {
            if (subscriber.onError) {
              subscriber.onError(error)
            }
            subscriber.onInitial(
              error,
              Number(id),
              Number(subscriberId),
              undefined,
              true
            )
            delete subscriber.onInitial
          }
          // delete whole subscription
        } else if (subscriber.onError) {
          subscriber.onError(error)
        }
      }
    } else if (previousChecksum === checksum) {
      if (subscription.authError) {
        delete subscription.authError
      }
      // should be enough...
      for (const subscriberId in subscription.subscribers) {
        const subscriber = subscription.subscribers[subscriberId]
        if (subscriber.onInitial) {
          subscriber.onInitial(
            null,
            Number(id),
            Number(subscriberId),
            client.cache[id].value
          )
          delete subscriber.onInitial
          if (!subscriber.onData) {
            removeSubscriber(client, id, Number(subscriberId))
          }
        }
      }
    } else {
      if (subscription.authError) {
        delete subscription.authError
      }

      client.cache[id] = {
        value,
        checksum,
      }
      for (const subscriberId in subscription.subscribers) {
        const subscriber = subscription.subscribers[subscriberId]
        if (subscriber.onInitial) {
          subscriber.onInitial(null, Number(id), Number(subscriberId), value)
          delete subscriber.onInitial
          if (!subscriber.onData) {
            removeSubscriber(client, id, Number(subscriberId))
          }
        }
        if (subscriber.onData) {
          subscriber.onData(value, checksum)
        }
      }
    }
  }
}
