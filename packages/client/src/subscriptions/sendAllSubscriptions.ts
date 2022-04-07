import { BasedClient } from '..'
import { RequestTypes } from '../types'
import { addToQueue } from '../queue'

export const sendAllSubscriptions = (
  client: BasedClient,
  reAuth: boolean = false
) => {
  for (const key in client.subscriptions) {
    const subscriptionId = Number(key)
    const subscription = client.subscriptions[key]
    if (reAuth && !subscription.authError) {
      // delete subscrption.authError
      continue
    }

    // for loop for has to include (for gets)

    let getInQ
    let queued
    let getIndex

    for (let i = 0; i < client.subscriptionQueue.length; i++) {
      const [type, id] = client.subscriptionQueue[i]

      if (id === subscriptionId) {
        if (type === RequestTypes.GetSubscription) {
          getIndex = i
          getInQ = client.subscriptionQueue[i]
        } else if (type === RequestTypes.Subscription) {
          queued = client.subscriptionQueue[i]
        }
      }
    }

    if (getInQ && queued) {
      console.error('GET IN Q AND SUB IN Q SHOULD BE IMPOSSIBLE')
    }

    const cache = client.cache[subscriptionId]

    // console.info(getInQ, queued)

    let x = false

    if (getInQ) {
      let onlyGets = true
      for (const k in subscription.subscribers) {
        const s = subscription.subscribers[k]
        if (s.onData) {
          onlyGets = false
          break
        }
      }

      if (onlyGets) {
        x = true
      } else {
        console.info('not only gets remove get')
        client.subscriptionQueue.splice(getIndex, 1)
      }

      if (cache && getInQ[3] !== cache.checksum) {
        getInQ[3] = cache.checksum
      }
    }

    if (!x) {
      if (queued) {
        if (cache && queued[3] !== cache.checksum) {
          queued[3] = cache.checksum
          if (getInQ) {
            queued[4] = 2
          }
        }
      } else {
        const { name, query } = client.subscriptions[subscriptionId]
        if (name) {
          if (cache) {
            addToQueue(client, [
              RequestTypes.Subscription,
              subscriptionId,
              query,
              cache.checksum,
              getInQ ? 2 : 0,
              name,
            ])
          } else {
            addToQueue(client, [
              RequestTypes.Subscription,
              subscriptionId,
              query,
              0,
              getInQ ? 2 : 0,
              name,
            ])
          }
        } else {
          if (cache) {
            addToQueue(client, [
              RequestTypes.Subscription,
              subscriptionId,
              query,
              cache.checksum,
              getInQ ? 2 : 0,
            ])
          } else {
            addToQueue(client, [
              RequestTypes.Subscription,
              subscriptionId,
              query,
              0,
              getInQ ? 2 : 0,
            ])
          }
        }
      }
    }
  }
}
