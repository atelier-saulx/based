module.exports = async (server, client) => {
  const authState = 'second_token'
  if (client.ws) {
    if (client.ws) {
      client.ws.authState = authState
      server.auth.sendAuthUpdate(client, authState)
    }
  } else {
    if (client.context) {
      client.context.authState = authState
    }
  }
  return true
}
