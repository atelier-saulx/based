import uws from '@based/uws'
import { parseAuthState } from '../auth'
import { WebSocketSession } from '../context'
import { blockIncomingRequest } from '../security'
import { BasedServer } from '../server'

let clientId = 0

const upgradeInternal = (
  res: uws.HttpResponse,
  req: uws.HttpRequest,
  // eslint-disable-next-line
  ctx: uws.us_socket_context_t,
  ip: string
) => {
  const query = req.getQuery() // encode
  const ua = req.getHeader('user-agent')
  const secWebSocketKey = req.getHeader('sec-websocket-key')
  const secWebSocketProtocol = req.getHeader('sec-websocket-protocol')
  const secWebSocketExtensions = req.getHeader('sec-websocket-extensions')
  res.writeStatus('101 Switching Protocols')
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

export const upgrade = (
  server: BasedServer,
  res: uws.HttpResponse,
  req: uws.HttpRequest,
  // eslint-disable-next-line
  ctx: uws.us_socket_context_t
) => {
  const ip =
    req.getHeader('x-forwarded-for') ||
    Buffer.from(res.getRemoteAddressAsText()).toString()
  if (blockIncomingRequest(server, ip, res, req, 25)) {
    return
  }
  upgradeInternal(res, req, ctx, ip)
}

export const upgradeAuthorize = (
  server: BasedServer,
  res: uws.HttpResponse,
  req: uws.HttpRequest,
  // eslint-disable-next-line
  ctx: uws.us_socket_context_t
) => {
  let aborted = false
  res.onAborted(() => {
    aborted = true
  })

  const ip =
    req.getHeader('x-forwarded-for') ||
    Buffer.from(res.getRemoteAddressAsText()).toString()

  // play with the number
  if (blockIncomingRequest(server, ip, res, req, 25)) {
    return
  }

  server.auth.authorizeConnection(req).then((authorized) => {
    if (aborted) {
      return
    }
    if (authorized) {
      upgradeInternal(res, req, ctx, ip)
    } else {
      res.writeStatus('401 Unauthorized')
      res.end()
    }
  })
}
