import { BasedClient } from '..'
import { AuthorizedData, ErrorObject } from '@based/types'
import createError from '../createError'

export const logoutSubscriptions = (
  client: BasedClient,
  data: AuthorizedData
) => {
  for (const sub of data[1]) {
    delete client.cache[sub]
    const subscription = client.subscriptions[sub]
    if (subscription) {
      const err: ErrorObject = {
        type: 'AuthorizationError',
        name: subscription.name ? `observe "${subscription.name}"` : 'observe',
        message: 'Unauthorized request',
        payload: subscription.query,
        auth: true,
      }
      const error = createError(err)
      subscription.authError = {
        token: client.token,
        error: error,
      }
      // console.error(error)
      for (const s in subscription.subscribers) {
        const subscriber = subscription.subscribers[s]
        if (subscriber.onError) {
          subscriber.onError(error)
        }
      }
    }
  }
}
