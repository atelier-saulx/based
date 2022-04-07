import { BasedClient } from '..'
import { RequestTypes } from '@based/types'

export const removeSendSubsriptionDataFromQueue = (client: BasedClient) => {
  for (let i = 0; i < client.subscriptionQueue.length; i++) {
    if (client.subscriptionQueue[i][0] === RequestTypes.SendSubscriptionData) {
      client.subscriptionQueue.splice(i, 1)
      i--
    }
  }
}
