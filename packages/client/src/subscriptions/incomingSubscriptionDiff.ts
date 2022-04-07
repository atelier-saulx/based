import { applyPatch } from '@saulx/diff'
import { BasedClient } from '..'
import { RequestTypes, SubscriptionDiffData } from '@based/types'
import { addToQueue } from '../queue'
import printBasedObject from '../printBasedObject'
import { removeSubscriber } from './removeSubscriber'

export const incomingSubscriptionDiff = (
  client: BasedClient,
  data: SubscriptionDiffData
) => {
  const [, id, diff, [fromChecksum, checksum]] = data
  const subscription = client.subscriptions[id]
  if (subscription) {
    const cache = client.cache[id]
    if (!cache || cache.checksum !== fromChecksum) {
      if (cache) {
        if (cache.checksum === checksum) {
          // console.warn('☄️ Received same data in diff do nothing')
          for (const subscriberId in subscription.subscribers) {
            const subscriber = subscription.subscribers[subscriberId]
            if (subscriber.onInitial) {
              subscriber.onInitial(
                null,
                Number(id),
                Number(subscriberId),
                cache.value
              )
              delete subscriber.onInitial
              if (!subscriber.onData) {
                removeSubscriber(client, id, Number(subscriberId))
              }
            }
          }
        } else {
          // console.warn(
          //   'Cannot apply diff need to re-get the data - do not have cache version mismatch'
          // )
          // has to be removed if sending a subscribe event
          addToQueue(client, [RequestTypes.SendSubscriptionData, id])
        }
      } else {
        // console.warn(
        //   'Cannot apply diff need to re-get the data - do not have cache'
        // )
        addToQueue(client, [RequestTypes.SendSubscriptionData, id])
      }
    } else {
      let isCorrupt = false
      try {
        cache.value = applyPatch(cache.value, diff)
        if (cache.value === null) {
          isCorrupt = true
        }
      } catch (err) {
        isCorrupt = true
      }
      if (!isCorrupt) {
        cache.checksum = checksum
        for (const subscriberId in subscription.subscribers) {
          const subscriber = subscription.subscribers[subscriberId]
          if (subscriber.onInitial) {
            subscriber.onInitial(
              null,
              Number(id),
              Number(subscriberId),
              cache.value
            )
            delete subscriber.onInitial

            if (!subscriber.onData) {
              removeSubscriber(client, id, Number(subscriberId))
            }
          }
          if (subscriber.onData) {
            subscriber.onData(cache.value, cache.checksum)
          }
        }
      } else {
        console.warn(
          `\nFound corrupt data while applying diff to subscription need to re-fetch\n`
        )
        console.warn(
          printBasedObject(subscription.query, 2, false, 'Query').join('\n') +
            '\n\n'
        )
        delete client.cache[id]
        addToQueue(client, [RequestTypes.SendSubscriptionData, id])
      }
    }
  }
}
