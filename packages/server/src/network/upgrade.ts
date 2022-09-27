import uws from '@based/uws'
import { AuthorizeConnection } from '../types'

let clientId = 0

export const upgrade = (
  res: uws.HttpResponse,
  req: uws.HttpRequest,
  // eslint-disable-next-line
  ctx: uws.us_socket_context_t
) => {
  const query = req.getQuery()
  const ua = req.getHeader('user-agent')
  // ip is 39 bytes - (adds 312kb for 8k clients to mem)
  const ip =
    req.getHeader('x-forwarded-for') ||
    Buffer.from(res.getRemoteAddressAsText()).toString()
  const secWebSocketKey = req.getHeader('sec-websocket-key')
  const secWebSocketProtocol = req.getHeader('sec-websocket-protocol')
  const secWebSocketExtensions = req.getHeader('sec-websocket-extensions')

  res.writeStatus('101 Switching Protocols')

  res.upgrade(
    {
      query,
      ua,
      ip,
      id: ++clientId,
      obs: new Set(),
      unauthorizedObs: new Set(),
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
