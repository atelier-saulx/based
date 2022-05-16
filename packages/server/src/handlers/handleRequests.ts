import messageParser from './messageParser'
import authorize from './authorize'
import { BasedServer } from '..'
import { Message, TrackMessage } from '@based/client'
import Client from '../Client'
import { getAuthorize } from '../getFromConfig'

export default (
  server: BasedServer,
  client: Client,
  messages: (Message | TrackMessage)[]
) => {
  if (messages && messages.length) {
    if (server.config?.authorize) {
      if (!server.config.authorize) {
        getAuthorize(server).then((auth) => {
          if (auth) {
            if (client.authorizeInProgress) {
              client.authorizeInProgress.then(() => {
                authorize(server, client, messages)
                  .then((messages) => {
                    if (messages) {
                      messageParser(server, client, messages)
                    }
                  })
                  .catch((err) => {
                    console.error('Error with authorize', err)
                  })
              })
            } else {
              authorize(server, client, messages)
                .then((messages) => {
                  if (messages) {
                    messageParser(server, client, messages)
                  }
                })
                .catch((err) => {
                  console.error('Error with authorize', err)
                })
            }
          } else {
            messageParser(server, client, messages)
          }
        })
      } else {
        if (client.authorizeInProgress) {
          client.authorizeInProgress.then(() => {
            authorize(server, client, messages)
              .then((messages) => {
                if (messages) {
                  messageParser(server, client, messages)
                }
              })
              .catch((err) => {
                console.error('Error with authorize', err)
              })
          })
        } else {
          authorize(server, client, messages)
            .then((messages) => {
              if (messages) {
                messageParser(server, client, messages)
              }
            })
            .catch((err) => {
              console.error('Error with authorize', err)
            })
        }
      }
    } else {
      console.warn('No authorize function found.')
    }
  }
}
