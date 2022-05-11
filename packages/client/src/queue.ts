import { BasedClient, TrackMessage } from '.'
import { AuthMessage, Message, RequestTypes } from '@based/types'
import idleTimeout from './idleTimeout'

export const addToQueue = (
  client: BasedClient,
  msg: Message | TrackMessage | AuthMessage
) => {
  if (
    msg[0] === RequestTypes.Unsubscribe ||
    msg[0] === RequestTypes.Subscription ||
    msg[0] === RequestTypes.SendSubscriptionData ||
    msg[0] === RequestTypes.GetSubscription
  ) {
    client.subscriptionQueue.push(msg)
  } else {
    client.queue.push(msg)
  }
  if (client.connected && !client.drainInProgress) {
    drainQueue(client)
  }
}

export const drainQueue = (client: BasedClient) => {
  if (
    client.connected &&
    !client.drainInProgress &&
    (client.queue.length || client.subscriptionQueue.length) &&
    !client.isLogginIn
  ) {
    client.drainInProgress = true
    client.drainTimeout = setTimeout(() => {
      client.drainInProgress = false
      if (client.queue.length || client.subscriptionQueue.length) {
        const queue = [...client.queue, ...client.subscriptionQueue]
        client.queue = []
        client.subscriptionQueue = []
        client.connection.ws.send(JSON.stringify(queue))
        idleTimeout(client)
      }
    }, 0)
  }
}

export const stopDrainQueue = (client: BasedClient) => {
  if (client.drainInProgress) {
    clearTimeout(client.drainTimeout)
    client.drainInProgress = false
  }
}
