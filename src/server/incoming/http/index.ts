import uws from '../../../uws/index.js'
import { BasedServer } from '../../server.js'
import { basicFunction } from './basicFunction.js'
import { httpStreamFunction } from './streamFunction/index.js'
import { httpGet } from './query.js'
import { sendError } from '../../sendError.js'
import {
  blockIncomingRequest,
  rateLimitRequest,
  endRateLimitHttp,
} from '../../security.js'
import { parseAuthState, parseJSONAuthState } from '../../auth/index.js'
import { authorize } from '../../authorize.js'
import { end } from '../../sendHttpResponse.js'
import { httpPublish } from './publish.js'
import { handleRequest } from './handleRequest.js'
import { handleFakeWs } from './fakeWs/index.js'
import { httpFunction } from './httpFunction.js'
import {
  isBasedRoute,
  type AuthState,
  type Context,
  type HttpSession,
} from '../../../functions/index.js'
import { BasedErrorCode } from '../../../errors/types.js'

let clientId = 0
const defHeaders = 'Authorization,Content-Type'

export const httpHandler = (
  server: BasedServer,
  req: uws.HttpRequest,
  res: uws.HttpResponse,
) => {
  let ctx: Context<HttpSession>

  res.onAborted(() => {
    if (ctx?.session) {
      ctx.session.res = null as any
      ctx.session.req = null as any
      ctx.session = null as any
    }
  })

  const ip = server.getIp(res, req)

  if (blockIncomingRequest(server, ip, res, req, server.rateLimit.http, 1)) {
    return
  }

  const method = req.getMethod()

  const url = req.getUrl()

  // Now we are doing this for fun
  const path = url.split('/')

  // TODO Use a header for this
  if (path[1] === 'based:rpstatus') {
    res.cork(() => {
      res.writeHeader('Access-Control-Allow-Headers', defHeaders)
      res.writeHeader('Access-Control-Expose-Headers', '*')
      res.writeHeader('Access-Control-Allow-Origin', '*')
      res.end(server.restFallbackPath)
    })
    return
  }

  // OR path[2]
  if (server.restFallbackPath && path[1] === server.restFallbackPath) {
    if (method !== 'post') {
      res.end()
      return
    }
    let authorization: string = path[2]
    if (!authorization || authorization.length > 5e3) {
      res.end()
      return
    }
    const authState = parseAuthState(authorization)
    if (authState.error === 'Invalid token') {
      res.end()
      return
    }
    ctx = {
      session: {
        url,
        res,
        req: req as any,
        method,
        origin: req.getHeader('origin'),
        ua: req.getHeader('user-agent'),
        ip,
        id: ++clientId,
        type: authState.t ?? 0,
        authState,
        // @ts-ignore
        headers: {
          'content-length': Number(req.getHeader('content-length')),
        },
      },
    }
    handleFakeWs(server, ctx)
    return
  }

  const route = server.functions.route(path[1], url)

  if (route === null || route?.internalOnly === true) {
    sendError(
      server,
      {
        session: {
          url,
          origin: req.getHeader('origin'),
          ua: req.getHeader('user-agent'),
          ip,
          method,
          id: ++clientId,
          headers: {},
          authState: {},
          res,
          req: req as any,
        },
      },
      BasedErrorCode.FunctionNotFound,
      path[1]
        ? { route: { name: path[1], type: 'function' } }
        : { route: { name: '', path: url, type: 'function' } },
    )
    return
  }

  let authState: AuthState = {}

  if (route?.public !== true) {
    let authorization: string = req.getHeader('authorization')
    if (authorization) {
      if (authorization.length > 5e3) {
        sendError(
          server,
          {
            session: {
              url,
              ua: req.getHeader('user-agent'),
              ip,
              method,
              origin: req.getHeader('origin'),
              id: ++clientId,
              headers: {},
              authState: {},
              res,
              req: req as any,
            },
          },
          BasedErrorCode.PayloadTooLarge,
          { route: { name: 'authorize', type: 'function' } },
        )
        return
      }
      authState = parseAuthState(authorization)
    } else {
      // TODO: remove this when c++ client can encode
      const authorization: string = req.getHeader('json-authorization')
      if (authorization) {
        authState = parseJSONAuthState(authorization)
      }
    }
  }

  ctx = {
    session: {
      url,
      res,
      req: req as any,
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
  const session = ctx.session!
  if (method === 'options') {
    if (route.headers) {
      for (const header of route.headers) {
        session.headers[header] = req.getHeader(header)
      }
      session.res.cork(() => {
        session.res.writeHeader(
          'Access-Control-Allow-Headers',
          defHeaders + ',' + route.headers!.join(','),
        )
        session.res.writeHeader('Access-Control-Expose-Headers', '*')
        session.res.writeHeader('Access-Control-Allow-Origin', '*')
      })
    } else {
      session.res.cork(() => {
        session.res.writeHeader('Access-Control-Allow-Headers', defHeaders)
        session.res.writeHeader('Access-Control-Expose-Headers', '*')
        session.res.writeHeader('Access-Control-Allow-Origin', '*')
      })
    }
  } else if (route?.headers) {
    for (const header of route.headers) {
      session.headers[header] = req.getHeader(header)
    }
  }

  if (
    rateLimitRequest(server, ctx, route?.rateLimitTokens, server.rateLimit.http)
  ) {
    endRateLimitHttp(res)
    return
  }

  const query = req.getQuery()
  if (query) {
    session.query = query
  }

  const len = req.getHeader('content-length')
  const lenConverted = len ? Number(len) : undefined
  if (lenConverted !== undefined && !isNaN(lenConverted)) {
    session.headers['content-length'] = lenConverted
  }

  // add extra leeway here
  if (
    (method === 'post' || method === 'put' || method === 'patch') &&
    session.headers['content-length'] === undefined
  ) {
    // Zero allowed, but not for streams
    sendError(server, ctx, BasedErrorCode.LengthRequired, route)
    return
  }

  if (route?.headers) {
    for (const header of route.headers) {
      const v = req.getHeader(header)
      if (v) {
        session.headers[header] = v
      }
    }
  }

  if (isBasedRoute('query', route)) {
    // Handle HEAD
    // if (method !== 'post' && method !== 'get') {
    // sendError(server, ctx, BasedErrorCode.MethodNotAllowed, route)
    // return
    // }
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
    // if (method !== 'post') {
    // sendError(server, ctx, BasedErrorCode.MethodNotAllowed, route)
    // return
    // }
    if (session.headers['content-length'] === 0) {
      // Zero is also not allowed for streams
      sendError(server, ctx, BasedErrorCode.LengthRequired, route)
      return
    }
    httpStreamFunction(server, ctx, route)
    return
  }

  if (isBasedRoute('channel', route)) {
    // if (method !== 'post' && method !== 'get') {
    //   sendError(server, ctx, BasedErrorCode.MethodNotAllowed, route)
    //   return
    // }
    handleRequest(server, method, ctx, route, (payload) => {
      authorize(
        {
          route,
          server,
          ctx,
          payload,
        },
        route.publicPublisher || route.public,
      ).then(httpPublish)
    })
    return
  }

  if (isBasedRoute('function', route)) {
    // if (method !== 'post' && method !== 'get') {
    //   sendError(server, ctx, BasedErrorCode.MethodNotAllowed, route)
    //   return
    // }
    handleRequest(server, method, ctx, route, (payload) => {
      authorize({ route, server, ctx, payload }).then(basicFunction)
    })
  }

  if (isBasedRoute('http', route)) {
    // if (method !== 'post' && method !== 'get') {
    //   sendError(server, ctx, BasedErrorCode.MethodNotAllowed, route)
    //   return
    // }
    handleRequest(server, method, ctx, route, (payload) => {
      authorize({ route, server, ctx, payload }).then(httpFunction)
    })
  }
}
