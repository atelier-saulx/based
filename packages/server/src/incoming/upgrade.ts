import uws from '@based/uws'
import { parseAuthState } from '../auth/index.js'
import { blockIncomingRequest } from '../security.js'
import { BasedServer } from '../server.js'
// import { BasedErrorCode } from '../error'

let clientId = 0

const upgradeInternal = (
  _server: BasedServer,
  res: uws.HttpResponse,
  req: uws.HttpRequest,
  // eslint-disable-next-line
  ctx: uws.us_socket_context_t,
  ip: string,
) => {
  const secWebSocketProtocol = req.getHeader('sec-websocket-protocol')
  const ua = req.getHeader('user-agent')

  if (!secWebSocketProtocol) {
    // server.emit(
    //   'error',
    //   {
    //     session: {
    //       ua,
    //       ip,
    //     },
    //   },
    //   { code: BasedErrorCode.MissingAuthStateProtocolHeader }
    // )
    // res.close()
    // return
    // TODO: fix this, no bueno
    console.warn('No sec-websocket-protocol in handshake...')
  }

  const query = req.getQuery()
  const secWebSocketKey = req.getHeader('sec-websocket-key')
  const secWebSocketExtensions = req.getHeader('sec-websocket-extensions')
  const origin = req.getHeader('origin')

  res.writeStatus('101 Switching Protocols')

  const [encodedAuthState, version] = secWebSocketProtocol.split(',')
  const authState = encodedAuthState ? parseAuthState(encodedAuthState) : {}

  res.upgrade(
    {
      query,
      ua,
      ip,
      id: ++clientId,
      authState,
      type: authState.t ?? 0,
      origin,
      obs: new Set(),
      version,
    },
    secWebSocketKey,
    secWebSocketProtocol,
    secWebSocketExtensions,
    ctx,
  )
}

export const upgrade = (
  server: BasedServer,
  res: uws.HttpResponse,
  req: uws.HttpRequest,
  // eslint-disable-next-line
  ctx: uws.us_socket_context_t,
) => {
  const ip = server.getIp(res, req)
  if (blockIncomingRequest(server, ip, res, req, server.rateLimit.ws, 10)) {
    return
  }
  upgradeInternal(server, res, req, ctx, ip)
}

export const upgradeAuthorize = (
  server: BasedServer,
  res: uws.HttpResponse,
  req: uws.HttpRequest,
  // eslint-disable-next-line
  ctx: uws.us_socket_context_t,
) => {
  let aborted = false
  res.onAborted(() => {
    aborted = true
  })
  const ip = server.getIp(res, req)
  if (blockIncomingRequest(server, ip, res, req, server.rateLimit.ws, 10)) {
    return
  }

  server.auth.authorizeConnection(server.client, req, ip).then((authorized) => {
    if (aborted) {
      return
    }
    if (authorized) {
      upgradeInternal(server, res, req, ctx, ip)
    } else {
      res.writeStatus('401 Unauthorized')
      res.end()
    }
  })
}
