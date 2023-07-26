import uws from '@based/uws'
import { BasedServer } from '../../server'
import {
  HttpSession,
  Context,
  AuthState,
  isBasedRoute,
  BasedRoute,
} from '@based/functions'
import { httpFunction } from './function'
import { httpStreamFunction } from './streamFunction'
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
import { parseAuthState, parseJSONAuthState } from '../../auth'
import { authorize } from '../../authorize'
import { end } from '../../sendHttpResponse'
import { httpPublish } from './publish'

let clientId = 0

const handleRequest = (
  server: BasedServer,
  method: string,
  ctx: Context<HttpSession>,
  route: BasedRoute,
  ready: (payload?: any) => void
) => {
  if (method === 'post') {
    readBody(server, ctx, ready, route)
  } else {
    ready(parseQuery(ctx))
  }
}

const getQuery = (req: uws.HttpRequest): { [key: string]: string } => {
  const obj = {},
    string = req.getQuery()
  let index = 0
  let index2: number
  let index3: number
  do {
    index2 = string.indexOf('=', index)
    if (index2 == -1) index2 = string.length
    index3 = string.indexOf('&', index2 + 1)
    if (index3 == -1) index3 = string.length
    obj[string.slice(index, index2)] = string.slice(index2 + 1, index3)
    index = index3 + 1
  } while (index3 != string.length)
  return obj
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

  const ip = server.getIp(res, req)

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
          origin: req.getHeader('origin'),
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
        ? { route: { name: path[1], type: 'function' } }
        : { route: { name: '', path: url, type: 'function' } }
    )
    return
  }

  let authState: AuthState = {}

  if (route.public !== true) {
    let authorization: string = req.getHeader('authorization')

    if (!authorization && req.getQuery()) {
      const query = getQuery(req)
      if (query.authorization) {
        authorization = query.authorization
      }
    }

    if (authorization.length > 5e3) {
      sendError(
        server,
        {
          session: {
            ua: req.getHeader('user-agent'),
            ip,
            method,
            origin: req.getHeader('origin'),
            id: ++clientId,
            headers: {},
            authState: {},
            res,
            req,
          },
        },
        BasedErrorCode.PayloadTooLarge,
        { route: { name: 'authorize', type: 'function' } }
      )
      return
    }
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
      origin: req.getHeader('origin'),
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

  if (method === 'options') {
    const defHeaders = 'Authorization,Content-Type'
    if (route.headers) {
      for (const header of route.headers) {
        ctx.session.headers[header] = req.getHeader(header)
      }
      ctx.session.res.cork(() => {
        ctx.session.res.writeHeader(
          'Access-Control-Allow-Headers',
          defHeaders + ',' + route.headers.join(',')
        )
        ctx.session.res.writeHeader('Access-Control-Expose-Headers', '*')
        ctx.session.res.writeHeader('Access-Control-Allow-Origin', '*')
      })
    } else {
      ctx.session.res.cork(() => {
        ctx.session.res.writeHeader('Access-Control-Allow-Headers', defHeaders)
        ctx.session.res.writeHeader('Access-Control-Expose-Headers', '*')
        ctx.session.res.writeHeader('Access-Control-Allow-Origin', '*')
      })
    }
  } else if (route.headers) {
    for (const header of route.headers) {
      ctx.session.headers[header] = req.getHeader(header)
    }
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

  if (isBasedRoute('query', route)) {
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

  if (isBasedRoute('stream', route)) {
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

  if (isBasedRoute('channel', route)) {
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
        route.publicPublisher || route.public
      )
    })
    return
  }

  if (isBasedRoute('function', route)) {
    if (method !== 'post' && method !== 'get') {
      sendError(server, ctx, BasedErrorCode.MethodNotAllowed, route)
      return
    }
    handleRequest(server, method, ctx, route, (payload) => {
      authorize(route, server, ctx, payload, httpFunction)
    })
  }
}
