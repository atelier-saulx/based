import { BasedClient } from '.'

export const idleTimeout = (client: BasedClient) => {
  const updateTime = 60 * 1e3
  clearTimeout(client.idlePing)
  client.idlePing = setTimeout(() => {
    if (
      client.connection &&
      client.connected &&
      !client.connection.disconnected
    ) {
      client.connection.ws.send('1')
    }
  }, updateTime)
}

export default idleTimeout
