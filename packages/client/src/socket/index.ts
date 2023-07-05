import { Connection } from './types'
import { BasedDbClient } from '..'
import { Socket } from 'node:net'

const connect = (
  client: BasedDbClient,
  port: number,
  host: string,
  connection: Connection = {},
  time = 0,
  reconnect = false
): Connection => {
  setTimeout(() => {
    if (connection.disconnected) {
      return
    }

    const socket = (connection.socket = new Socket())

    let isError = false

    socket.connect(
      {
        port,
        host,
      },
      () => {
        if (connection.disconnected) {
          return
        }
        time = 100
        if (reconnect) {
          client.onReconnect()
        }
        client.onOpen()
      }
    )

    socket.on('error', (err) => {
      console.info('erropr')
      // for special codes
      //   isError = true
    })

    socket.on('data', (data) => {
      client.onData(data)
    })

    socket.on('open', () => {
      if (connection.disconnected) {
        return
      }
      time = 100
      if (reconnect) {
        client.onReconnect()
      }
      client.onOpen()
    })

    socket.on('close', () => {
      socket.destroy()
      if (connection.disconnected) {
        return
      }
      client.onClose()
      connect(
        client,
        port,
        host,
        connection,
        // relatively low backoff but will make it faster if multiple servers are down
        isError ? 5e3 : Math.min(2500, time + ~~(Math.random() * 500) + 100),
        true
      )
    })
  }, time)

  return connection
}

export default connect
