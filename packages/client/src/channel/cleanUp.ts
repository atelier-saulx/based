import { BasedClient } from '../index.js'

export const cleanUpChannels = (client: BasedClient) => {
  if (!client.channelCleanTimeout) {
    client.channelCleanTimeout = setTimeout(() => {
      client.channelCleanTimeout = null
      if (client.connected) {
        let keepRunning = false
        client.channelState.forEach((value, key) => {
          if (value.removeTimer !== -1) {
            value.removeTimer--
            if (value.removeTimer === 0) {
              client.channelState.delete(key)
            } else {
              keepRunning = true
            }
          }
        })
        if (keepRunning) {
          cleanUpChannels(client)
        }
      } else {
        cleanUpChannels(client)
      }
    }, client.channelCleanupCycle)
  }
}
