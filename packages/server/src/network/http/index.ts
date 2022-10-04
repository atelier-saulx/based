import uws from '@based/uws'
import { BasedServer } from '../../server'
import { BasedFunctionRoute, HttpClient } from '../../types'
import { httpFunction } from './function'
import { httpStreamFunction } from './streamFunction'
import { httpGet } from './get'
import { parseQuery } from '@saulx/utils'
import { readBody } from './readBody'
import { sendHttpError } from './send'
import { authorizeRequest } from './authorize'
import { BasedErrorCode } from '../../error'

let clientId = 0

const handleRequest = (
  server: BasedServer,
  method: string,
  client: HttpClient,
  route: BasedFunctionRoute,
  authorized: (payload: any) => void
) => {
  if (method === 'post') {
    readBody(
      server,
      client,
      (payload) => authorizeRequest(server, client, payload, route, authorized),
      route
    )
  } else {
    const payload = parseQuery(client.context.query)
    authorizeRequest(server, client, payload, route, authorized)
  }
}

export const httpHandler = (
  server: BasedServer,
  req: uws.HttpRequest,
  res: uws.HttpResponse
) => {
  res.onAborted(() => {
    client.context = null
    client.res = null
    client.req = null
  })

  const ip =
    req.getHeader('x-forwarded-for') ||
    Buffer.from(res.getRemoteAddressAsText()).toString()

  if (server.blocked.has(ip)) {
    res.writeStatus('429 Too Many Requests')
    res.end()
    return
  }

  const url = req.getUrl()
  const path = url.split('/')
  const route = server.functions.route(path[1], url)

  if (route === false) {
    sendHttpError(
      server,
      {
        res,
        req,
        // @ts-ignore (ignore because we dont need a lot here)
        context: { ip, id: ++clientId, headers: {} },
      },
      BasedErrorCode.FunctionNotFound,
      { path, name: path[1] }
    )
    return
  }

  const method = req.getMethod()

  const client: HttpClient = {
    res,
    req,
    context: {
      query: req.getQuery(),
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

  const len = req.getHeader('content-length')
  // @ts-ignore
  if (len && !isNaN(len)) {
    client.context.headers['content-length'] = Number(len)
  }

  if (
    method === 'post' &&
    client.context.headers['content-length'] === undefined
  ) {
    // zero allowed, but not for streams
    sendHttpError(server, client, BasedErrorCode.LengthRequired, route)
    return
  }

  if (route.headers) {
    for (const header of route.headers) {
      const v = req.getHeader(header)
      if (v) {
        client.context[header] = v
      }
    }
  }

  if (route.observable === true) {
    if (route.stream) {
      sendHttpError(
        server,
        client,
        BasedErrorCode.CannotStreamToObservableFunction,
        route
      )
      return
    }
    const checksumRaw = req.getHeader('if-none-match')
    // @ts-ignore use isNaN to cast string to number
    const checksum = !isNaN(checksumRaw) ? Number(checksumRaw) : 0
    handleRequest(server, method, client, route, (payload) =>
      httpGet(route, payload, client, server, checksum)
    )
  } else {
    if (route.stream === true) {
      if (method !== 'post') {
        sendHttpError(server, client, BasedErrorCode.MethodNotAllowed, route)
        return
      }

      if (client.context.headers['content-length'] === 0) {
        // zero is also not allowed for streams
        sendHttpError(server, client, BasedErrorCode.LengthRequired, route)
        return
      }

      httpStreamFunction(
        server,
        client,
        parseQuery(client.context.query),
        route
      )
    } else {
      handleRequest(server, method, client, route, (payload) =>
        httpFunction(route, payload, client, server)
      )
    }
  }
}
