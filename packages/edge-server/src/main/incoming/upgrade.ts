import uws from '@based/uws'
import { AuthorizeConnection } from '../../types'

let clientId = 0

// const encoder = new TextEncoder()

export const upgrade = (
  res: uws.HttpResponse,
  req: uws.HttpRequest,
  // eslint-disable-next-line
  ctx: uws.us_socket_context_t
) => {
  const query = req.getQuery() // encode
  const ua = req.getHeader('user-agent')

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
      headers: {}, // TODO: can add some extra headers here
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
