import messageParser from './messageParser'
import authorize from './authorize'
import { BasedServer } from '..'
import { Message, TrackMessage } from '@based/client'
import Client from '../Client'
import { getDefaultFunction } from '../getFromConfig'

export default (
  server: BasedServer,
  client: Client,
  messages: (Message | TrackMessage)[]
) => {
  if (messages && messages.length) {
    if (
      server.config?.authorize ||
      (server.config?.functionConfig && !server.config?.noAuth)
    ) {
      if (!server.config.authorize) {
        getDefaultFunction(server, 'authorize').then((auth) => {
          if (auth) {
            if (client.authorizeInProgress) {
              client.authorizeInProgress.then(() => {
                authorize(server, client, messages).then((messages) => {
                  if (messages) {
                    messageParser(server, client, messages)
                  }
                })
              })
            } else {
              authorize(server, client, messages).then((messages) => {
                if (messages) {
                  messageParser(server, client, messages)
                }
              })
            }
          } else {
            messageParser(server, client, messages)
          }
        })
      } else {
        if (client.authorizeInProgress) {
          client.authorizeInProgress.then(() => {
            authorize(server, client, messages).then((messages) => {
              if (messages) {
                messageParser(server, client, messages)
              }
            })
          })
        } else {
          authorize(server, client, messages).then((messages) => {
            if (messages) {
              messageParser(server, client, messages)
            }
          })
        }
      }
    } else {
      messageParser(server, client, messages)
    }
  }
}
