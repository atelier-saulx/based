import uws from '@based/uws'
import { BasedServer } from '../../server'
import { BasedFunctionRoute, HttpClient } from '../../types'
import { httpFunction } from './function'
import { httpStreamFunction } from './streamFunction'
import { httpGet } from './get'
import { parseQuery } from '@saulx/utils'
import { readBody } from './readBody'
import { sendHttpError, sendErrorRaw } from './send'
import { authorizeRequest } from './authorize'

let clientId = 0

// these can be stored on context
// const allowedHeaders = [
//   'x-forwarded-for',
//   'user-agent',
//   'authorization',
//   'accept',
//   'accept-language',
//   'accept-encoding',
//   'referer',
//   'connection',
//   'upgrade-insecure-requests',
//   'if-modified-since',
//   'if-none-match',
//   'cache-control',
//   'host',
//   'origin',
//   'pragma',
// ]

const handleRequest = (
  server: BasedServer,
  method: string,
  client: HttpClient,
  route: BasedFunctionRoute,
  authorized: (payload: any) => void
) => {
  if (method === 'post') {
    readBody(
      client,
      (payload) => authorizeRequest(server, client, payload, route, authorized),
      route.maxPayloadSize
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
    sendErrorRaw(res, 'Too Many Requests', 429)
    return
  }

  const url = req.getUrl()
  const path = url.split('/')

  const route = server.functions.route(path[1], url)

  if (route === false) {
    sendErrorRaw(res, 'Not found', 404)
    return
  }

  // add all headers in context that are specialy defined for the route
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

  // client.res.writeHeader('Transfer-Encoding', 'gzip')

  if (
    method === 'post' &&
    client.context.headers['content-length'] === undefined
  ) {
    // zero is also not allowed
    sendHttpError(client, 'Length required', 411)
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

  client.res.writeHeader('Access-Control-Allow-Origin', '*')
  // only allowed headers
  client.res.writeHeader('Access-Control-Allow-Headers', '*')

  if (route.observable === true) {
    if (route.stream) {
      sendHttpError(client, 'Cannot stream to observable functions', 400)
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
        sendHttpError(client, 'Method not allowed', 405)
        return
      }

      if (client.context.headers['content-length'] === 0) {
        // zero is also not allowed for streams
        sendHttpError(client, 'Length required', 411)
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
