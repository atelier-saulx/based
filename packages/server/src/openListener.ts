import uws from '@based/uws'
import { BasedServer } from '.'
import Client from './Client'

const open = (server: BasedServer, socket: uws.WebSocket) => {
  const client = new Client(server, socket)
  server.clients[client.id] = client
  server.emit('open', client)
}

export default open
