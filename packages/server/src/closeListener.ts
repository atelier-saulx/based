import uws from '@based/uws'
import { BasedServer } from '.'

const close = (server: BasedServer, socket: uws.WebSocket) => {
  if (!socket.client) {
    return
  }
  const client = socket.client
  server.emit('close', client)
  delete server.clients[client.id]
  client.destroy(true)
}

export default close
