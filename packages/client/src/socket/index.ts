import { Connection } from './types.js'
import { BasedDbClient } from '../index.js'
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

    socket.connect(
      {
        port,
        host,
      },
      () => {
        if (connection.disconnected) {
          return
        }
        time = 200
        if (reconnect) {
          client.onReconnect()
        }
        client.onOpen()
      }
    )

    socket.on('error', (_err) => {})

    socket.on('data', (data) => {
      client.onData(data)
    })

    socket.on('close', () => {
      socket.removeAllListeners()
      socket.destroy()
      socket.unref()
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
        Math.min(2500, time + ~~(Math.random() * 500) + 200),
        true
      )
    })
  }, time)

  return connection
}

export default connect
