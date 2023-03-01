import uws from '@based/uws'
import { BasedServer } from '../../server'
import { HttpSession, Context, AuthState } from '@based/functions'
import { httpFunction } from './function'
import { httpStreamFunction } from './streamFunction'
import {
  BasedFunctionRoute,
  isChannelFunctionRoute,
  isFunctionRoute,
  isQueryFunctionRoute,
  isStreamFunctionRoute,
} from '../../functions'
import { httpGet } from './query'
import { readBody } from './readBody'
import { BasedErrorCode } from '../../error'
import { sendError } from '../../sendError'
import {
  blockIncomingRequest,
  rateLimitRequest,
  endRateLimitHttp,
} from '../../security'
import parseQuery from './parseQuery'
import { getIp } from '../../ip'
import { parseAuthState, parseJSONAuthState } from '../../auth'
import { authorize } from '../../authorize'
import { end } from '../../sendHttpResponse'
import { httpPublish } from './publish'

let clientId = 0

const handleRequest = (
  server: BasedServer,
  method: string,
  ctx: Context<HttpSession>,
  route: BasedFunctionRoute,
  ready: (payload?: any) => void
) => {
  if (method === 'post') {
    readBody(server, ctx, ready, route)
  } else {
    ready(parseQuery(ctx))
  }
}

export const httpHandler = (
  server: BasedServer,
  req: uws.HttpRequest,
  res: uws.HttpResponse
) => {
  res.onAborted(() => {
    ctx.session.res = null
    ctx.session.req = null
    ctx.session = null
  })

  const ip = getIp(res)

  if (blockIncomingRequest(server, ip, res, req, server.rateLimit.http, 1)) {
    return
  }

  const method = req.getMethod()
  const url = req.getUrl()
  const path = url.split('/')
  const route = server.functions.route(path[1], url)

  if (route === null || route.internalOnly === true) {
    sendError(
      server,
      {
        session: {
          ua: req.getHeader('user-agent'),
          ip,
          method,
          id: ++clientId,
          headers: {},
          authState: {},
          res,
          req,
        },
      },
      BasedErrorCode.FunctionNotFound,
      path[1]
        ? { route: { name: path[1] } }
        : { route: { name: '', path: url } }
    )
    return
  }

  let authState: AuthState = {}

  if (route.public !== true) {
    const authorization: string = req.getHeader('authorization')
    if (authorization) {
      authState = parseAuthState(authorization)
    } else {
      // TODO: remove this when c++ client can encode
      const authorization: string = req.getHeader('json-authorization')
      if (authorization) {
        authState = parseJSONAuthState(authorization)
      }
    }
  }

  const ctx: Context<HttpSession> = {
    session: {
      res,
      req,
      method,
      ua: req.getHeader('user-agent'),
      ip,
      id: ++clientId,
      authState,
      headers: {
        'content-type': req.getHeader('content-type'),
        'content-encoding': req.getHeader('content-encoding'),
        encoding: req.getHeader('accept-encoding'),
      },
    },
  }

  if (route.headers) {
    for (const header of route.headers) {
      ctx.session.headers[header] = req.getHeader(header)
    }
    ctx.session.res.writeHeader(
      'Access-Control-Allow-Headers',
      route.headers.join(',')
    )
    ctx.session.res.writeHeader('Access-Control-Expose-Headers', '*')
    ctx.session.res.writeHeader('Access-Control-Allow-Origin', '*')
    ctx.session.corsSend = true
  }

  if (
    rateLimitRequest(server, ctx, route.rateLimitTokens, server.rateLimit.http)
  ) {
    endRateLimitHttp(res)
    return
  }

  const query = req.getQuery()
  if (query) {
    ctx.session.query = query
  }

  const len = req.getHeader('content-length')
  const lenConverted = len ? Number(len) : undefined
  if (lenConverted !== undefined && !isNaN(lenConverted)) {
    ctx.session.headers['content-length'] = lenConverted
  }

  if (
    method === 'post' &&
    ctx.session.headers['content-length'] === undefined
  ) {
    // Zero allowed, but not for streams
    sendError(server, ctx, BasedErrorCode.LengthRequired, route)
    return
  }

  if (route.headers) {
    for (const header of route.headers) {
      const v = req.getHeader(header)
      if (v) {
        ctx.session.headers[header] = v
      }
    }
  }

  if (isQueryFunctionRoute(route)) {
    // Handle HEAD
    if (method !== 'post' && method !== 'get') {
      sendError(server, ctx, BasedErrorCode.MethodNotAllowed, route)
      return
    }
    const checksumRaw = req.getHeader('if-none-match')
    const checksumNum = Number(checksumRaw)
    const checksum = !isNaN(checksumNum) ? checksumNum : 0
    handleRequest(server, method, ctx, route, (payload) => {
      httpGet(route, payload, ctx, server, checksum)
    })
    return
  }

  if (isStreamFunctionRoute(route)) {
    if (method === 'options') {
      end(ctx)
      return
    }
    if (method !== 'post') {
      sendError(server, ctx, BasedErrorCode.MethodNotAllowed, route)
      return
    }
    if (ctx.session.headers['content-length'] === 0) {
      // Zero is also not allowed for streams
      sendError(server, ctx, BasedErrorCode.LengthRequired, route)
      return
    }
    httpStreamFunction(server, ctx, route)
    return
  }

  if (isChannelFunctionRoute(route)) {
    if (method !== 'post' && method !== 'get') {
      sendError(server, ctx, BasedErrorCode.MethodNotAllowed, route)
      return
    }
    handleRequest(server, method, ctx, route, (payload) => {
      authorize(
        route,
        server,
        ctx,
        payload,
        httpPublish,
        undefined,
        undefined,
        route.publisher?.public || route.public
      )
    })
    return
  }

  if (isFunctionRoute(route)) {
    if (method !== 'post' && method !== 'get') {
      sendError(server, ctx, BasedErrorCode.MethodNotAllowed, route)
      return
    }
    handleRequest(server, method, ctx, route, (payload) => {
      authorize(route, server, ctx, payload, httpFunction)
    })
  }
}
