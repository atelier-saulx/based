import { Socket } from 'node:net'

export type Connection = {
  socket?: Socket
  disconnected?: boolean
}

export type SocketCallbacks = {
    onOpen: () => void,
    onData: (buf: Buffer) => void;
    onReconnect: () => void;
    onClose: () => void;
};

const connect = (
  port: number,
  host: string,
  callbacks: SocketCallbacks,
  connection: Connection = {},
  time = 0,
  reconnect = false,
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
        socket.setNoDelay(true);
        time = 200
        if (reconnect) {
          callbacks.onReconnect()
        }
        callbacks.onOpen()
      }
    )

    socket.on('error', (_err) => {})

    socket.on('data', callbacks.onData)
    socket.on('close', () => {
      socket.removeAllListeners()
      socket.destroy()
      socket.unref()
      if (connection.disconnected) {
        return
      }
      callbacks.onClose()

      connect(
        port,
        host,
        callbacks,
        connection,
        // relatively low backoff but will make it faster if multiple servers are down
        Math.min(2500, time + ~~(Math.random() * 500) + 200),
        true,
      )
    })
  }, time)

  return connection
}

export default connect
