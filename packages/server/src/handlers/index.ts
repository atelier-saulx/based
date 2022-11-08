import uws from '@based/uws'
import { BasedServer } from '..'
import { RequestTypes, Message } from '@based/client'
import handleRequests from './handleRequests'
import authToken from './token'

const enc = new TextDecoder('utf-8')

const message = (
  server: BasedServer,
  socket: uws.WebSocket,
  message: ArrayBuffer
) => {
  if (!socket.client) {
    socket.end()
    return
  }

  let messages: Message[]

  // split up in token and messages

  try {
    const decoded = enc.decode(message)

    if (decoded === '1') {
      // --------------
    } else {
      try {
        const payload = JSON.parse(decoded)
        if (payload[0] === RequestTypes.Token) {
          if (payload[1]) {
            const options = payload[2]
            authToken(socket.client, server, payload[1], options)
          } else {
            authToken(socket.client, server, false)
          }
        } else {
          messages = payload
        }
      } catch (err) {
        // -----------
      }
    }
  } catch (err) {
    // ------------------
  }
  handleRequests(server, socket.client, messages)
}

export default message
