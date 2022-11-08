import uws from '@based/uws'
import { BasedServer } from '.'

export default (
  server: BasedServer,
  res: uws.HttpResponse,
  req: uws.HttpRequest,
  // eslint-disable-next-line
  ctx: uws.us_socket_context_t
) => {
  let aborted
  const onAborted = () => {
    aborted = true
  }
  // res.writeStatus('101 Switching Protocols')

  const onAuth = (authorized) => {
    if (aborted) {
      return
    }
    if (authorized) {
      const query = req.getQuery()
      const url = req.getUrl()
      const ua = req.getHeader('user-agent')
      const ip =
        req.getHeader('x-forwarded-for') ||
        Buffer.from(res.getRemoteAddressAsText()).toString()
      const origin = req.getHeader('origin')
      const secWebSocketKey = req.getHeader('sec-websocket-key')
      const secWebSocketProtocol = req.getHeader('sec-websocket-protocol')
      const secWebSocketExtensions = req.getHeader('sec-websocket-extensions')

      res.writeStatus('101 Switching Protocols')

      res.upgrade(
        {
          query,
          origin,
          url,
          ua,
          ip,
        },
        secWebSocketKey,
        secWebSocketProtocol,
        secWebSocketExtensions,
        ctx
      )
    } else {
      res.writeStatus('401 Unauthorized')
      res.end()
    }
  }

  res.onAborted(onAborted)

  if (server.config && server.config.authorizeConnection) {
    server.config.authorizeConnection(req, ctx).then(onAuth)
  } else {
    onAuth(true)
  }
}
