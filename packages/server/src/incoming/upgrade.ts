import uws from '@based/uws'
import { parseAuthState } from '../auth'
import { WebSocketSession } from '../context'
import { blockIncomingRequest } from '../security'
import { BasedServer } from '../server'
import { getIp } from '../ip'

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
        : {},
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
  const ip = getIp(res)
  if (blockIncomingRequest(server, ip, res, req, server.rateLimit.ws, 10)) {
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
  const ip = getIp(res)
  if (blockIncomingRequest(server, ip, res, req, server.rateLimit.ws, 10)) {
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
