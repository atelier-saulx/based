import uws from '@based/uws'
import { AuthorizeConnection, parseAuthState } from '../auth'
import { WebSocketSession } from '../context'

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

  /*
   try {
    authState = JSON.parse(authPayload)
  } catch (err) {
    authState = authPayload
  }
  */

  // TODO: authState in upgrade
  res.upgrade(
    <WebSocketSession>{
      query,
      ua,
      ip,
      id: ++clientId,
      authState: secWebSocketProtocol
        ? parseAuthState(decodeURI(secWebSocketProtocol))
        : undefined, // May want to try and parse the auth....
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
