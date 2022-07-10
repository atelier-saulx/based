import uws from '@based/uws'
import { AuthorizeConnection } from '../types'

export const upgrade = (
  res: uws.HttpResponse,
  req: uws.HttpRequest,
  // eslint-disable-next-line
  ctx: uws.us_socket_context_t
) => {
  const query = req.getQuery()
  const ua = req.getHeader('user-agent')
  const ip =
    req.getHeader('x-forwarded-for') ||
    Buffer.from(res.getRemoteAddressAsText()).toString()
  const secWebSocketKey = req.getHeader('sec-websocket-key')
  const secWebSocketProtocol = req.getHeader('sec-websocket-protocol')
  const secWebSocketExtensions = req.getHeader('sec-websocket-extensions')

  res.writeStatus('101 Switching Protocols')

  // ip is 39 bytes - may want to make this nicer (adds 312kb for 8k clients to mem)

  // userdata is essentaily the client
  res.upgrade(
    {
      query,
      ua,
      ip,
    },
    secWebSocketKey,
    secWebSocketProtocol,
    secWebSocketExtensions,
    ctx
  )
}

export const upgradeAuthorize = (
  authorizeConnection: AuthorizeConnection,
  res: uws.HttpResponse,
  req: uws.HttpRequest,
  // eslint-disable-next-line
  ctx: uws.us_socket_context_t
) => {
  let aborted = false
  res.onAborted(() => {
    aborted = true
  })
  authorizeConnection(req).then((authorized) => {
    if (aborted) {
      return
    }
    if (authorized) {
      upgrade(res, req, ctx)
    } else {
      res.writeStatus('401 Unauthorized')
      res.end()
    }
  })
}
