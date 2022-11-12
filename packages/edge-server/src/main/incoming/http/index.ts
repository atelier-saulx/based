import uws from '@based/uws'
import { BasedServer } from '../../server'
import { BasedFunctionRoute, HttpClient } from '../../../types'
import { httpFunction } from './function'
import { httpStreamFunction } from './streamFunction'
import { httpGet } from './get'
import { parseQuery } from '@saulx/utils'
import { readBody } from './readBody'
import { authorizeRequest } from './authorize'
import { BasedErrorCode, sendError } from '../../error'
import { incomingCounter } from '../../security'

let clientId = 0

// TODO: re-add authorize
const handleRequest = (
  server: BasedServer,
  method: string,
  client: HttpClient,
  route: BasedFunctionRoute,
  ready: (payload?: any) => void
) => {
  // send shared array buffer
  if (method === 'post') {
    readBody(server, client, ready, route)
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
    client.context = null
    client.res = null
    client.req = null
  })

  const ip =
    req.getHeader('x-forwarded-for') ||
    Buffer.from(res.getRemoteAddressAsText()).toString()

  if (incomingCounter(server, ip)) {
    res.writeStatus('429 Too Many Requests')
    res.end()
    return
  }

  const url = req.getUrl()
  const path = url.split('/')
  const route = server.functions.route(path[1], url)

  if (route === false) {
    sendError(
      server,
      {
        res,
        req,
        // @ts-ignore (ignore because we dont need a lot here)
        context: { ip, id: ++clientId, headers: {} },
      },
      BasedErrorCode.FunctionNotFound,
      path[1] ? { name: path[1] } : { path: url }
    )
    return
  }

  const method = req.getMethod()

  // const valid = simdjson.isValid(jsonString); // true
  // read only...

  const client: HttpClient = {
    res,
    req,
    context: {
      method,
      query: req.getQuery(), // need to use this if payload is undefined ? // maybe add method here?
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
    sendError(server, client, BasedErrorCode.LengthRequired, route)
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
      sendError(
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
    handleRequest(server, method, client, route, (payload) => {
      authorizeRequest(server, client, payload, route, () => {
        httpGet(route, payload, client, server, checksum)
      })
    })
  } else {
    if (route.stream === true) {
      if (method !== 'post') {
        sendError(server, client, BasedErrorCode.MethodNotAllowed, route)
        return
      }
      if (client.context.headers['content-length'] === 0) {
        // zero is also not allowed for streams
        sendError(server, client, BasedErrorCode.LengthRequired, route)
        return
      }
      let p
      if (client.context.query) {
        try {
          p = parseQuery(client.context.query)
        } catch (err) {}
      }
      httpStreamFunction(server, client, p, route)
    } else {
      handleRequest(server, method, client, route, (payload) =>
        httpFunction(method, route, client, server, payload)
      )
    }
  }
}
