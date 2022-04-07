import { BasedClient } from '.'
import { RequestTypes, SendTokenOptions } from '@based/types'
import idleTimeout from './idleTimeout'

import { sendAllSubscriptions } from './subscriptions'

const notUndefinedOrNull = (v: any) => typeof v !== 'undefined' && v !== null

const sendToken = (
  client: BasedClient,
  token?: string,
  options?: SendTokenOptions
) => {
  client.beingAuth = true
  if (token) {
    client.token = token
    client.sendTokenOptions = options
  } else {
    for (const id in client.cache) {
      if (!client.subscriptions[id]) {
        delete client.cache[id]
      }
    }
    delete client.token
    delete client.sendTokenOptions
  }
  if (client.connected) {
    const message = token
      ? [RequestTypes.Token, token, options].filter(notUndefinedOrNull)
      : [RequestTypes.Token]
    client.connection.ws.send(JSON.stringify(message))
    idleTimeout(client)
    sendAllSubscriptions(client, true)
  }
}

export default sendToken
