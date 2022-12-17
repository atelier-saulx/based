import uws from '@based/uws'
import { BasedServer } from '../../server'
import { HttpSession, Context } from '../../context'
import { httpFunction } from './function'
import { httpStreamFunction } from './streamFunction'
import { BasedFunctionRoute } from '../../functions'
import { httpGet } from './get'
import { parseQuery } from '@saulx/utils'
import { readBody } from './readBody'
import { authorizeRequest } from './authorize'
import { BasedErrorCode } from '../../error'
import { sendError } from '../../sendError'
import { incomingCounter } from '../../security'

let clientId = 0

const handleRequest = (
  server: BasedServer,
  method: string,
  ctx: Context<HttpSession>,
  route: BasedFunctionRoute,
  ready: (payload?: any) => void
) => {
  // send shared array buffer
  if (method === 'post') {
    readBody(server, ctx, ready, route)
  } else {
    ready()
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

  const ip =
    req.getHeader('x-forwarded-for') ||
    Buffer.from(res.getRemoteAddressAsText()).toString()

  if (incomingCounter(server, ip, req)) {
    res.writeStatus('429 Too Many Requests')
    res.end()
    return
  }

  const url = req.getUrl()
  const path = url.split('/')
  const route = server.functions.route(path[1], url)
  const method = req.getMethod()

  if (route === false) {
    sendError(
      server,
      {
        session: {
          ua: req.getHeader('user-agent'),
          ip,
          method,
          id: ++clientId,
          headers: {},
          res,
          req,
        },
      },
      BasedErrorCode.FunctionNotFound,
      path[1] ? { name: path[1] } : { name: '', path: url }
    )
    return
  }

  const ctx: Context<HttpSession> = {
    session: {
      res,
      req,
      method,
      ua: req.getHeader('user-agent'),
      ip,
      id: ++clientId,
      headers: {
        authorization: req.getHeader('authorization'),
        'content-type': req.getHeader('content-type'),
        'content-encoding': req.getHeader('content-encoding'),
        encoding: req.getHeader('accept-encoding'),
      },
    },
  }

  const query = req.getQuery()
  if (query) {
    ctx.session.query = query
  }

  const len = req.getHeader('content-length')
  // @ts-ignore use isNan as number check
  if (len && !isNaN(len)) {
    ctx.session.headers['content-length'] = Number(len)
  }

  if (
    method === 'post' &&
    ctx.session.headers['content-length'] === undefined
  ) {
    // zero allowed, but not for streams
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

  if (route.observable === true) {
    if (route.stream) {
      sendError(
        server,
        ctx,
        BasedErrorCode.CannotStreamToObservableFunction,
        route
      )
      return
    }
    const checksumRaw = req.getHeader('if-none-match')
    // @ts-ignore use isNaN to cast string to number
    const checksum = !isNaN(checksumRaw) ? Number(checksumRaw) : 0
    handleRequest(server, method, ctx, route, (payload) => {
      authorizeRequest(server, ctx, payload, route, () => {
        httpGet(route, payload, ctx, server, checksum)
      })
    })
  } else {
    if (route.stream === true) {
      if (method !== 'post') {
        sendError(server, ctx, BasedErrorCode.MethodNotAllowed, route)
        return
      }
      if (ctx.session.headers['content-length'] === 0) {
        // zero is also not allowed for streams
        sendError(server, ctx, BasedErrorCode.LengthRequired, route)
        return
      }
      let p: any
      if ('query' in ctx.session) {
        try {
          p = parseQuery(ctx.session.query)
        } catch (err) {}
      }
      httpStreamFunction(server, ctx, p, route)
    } else {
      handleRequest(server, method, ctx, route, (payload) => {
        authorizeRequest(server, ctx, payload, route, () => {
          httpFunction(method, route, ctx, server, payload)
        })
      })
    }
  }
}
