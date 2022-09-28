import uws from '@based/uws'
import { BasedServer } from '../../server'
import { HttpClient } from '../../types'
import { httpFunction } from './function'
import { httpGet } from './get'
import { parseQuery } from '@saulx/utils'
import { readBody } from './readBody'
import { sendError, sendErrorRaw } from './sendError'

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

const authorizeRequest = (
  server: BasedServer,
  client: HttpClient,
  payload: any,
  type: 'function' | 'observe',
  name: string,
  authorized: () => void
) => {
  server.auth.config
    .authorize(server, client, type, name, payload)
    .then((ok) => {
      if (!client.res) {
        return
      }
      if (!ok) {
        sendError(client, `${name} unauthorized request`, 401, 'Unauthorized')
      } else {
        authorized()
      }
    })
    .catch((err) => sendError(client, err.message, 401, 'Unauthorized'))
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

  // ip is 39 bytes - (adds 312kb for 8k clients to mem)
  const ip =
    req.getHeader('x-forwarded-for') ||
    Buffer.from(res.getRemoteAddressAsText()).toString()

  if (server.blocked.has(ip)) {
    sendErrorRaw(res, 'Too Many Requests', 429, 'Too Many Requests')
    return
  }

  const url = req.getUrl()
  const path = url.split('/')

  const route = server.functions.route(path[1], url)

  if (route === false) {
    sendErrorRaw(res, 'Not found', 404, 'Not found')
    return
  }

  // add all headers in context that are specialy defined for the route

  const method = req.getMethod()
  const incomingEncoding = req.getHeader('content-encoding')
  const encoding = req.getHeader('accept-encoding')

  const client: HttpClient = {
    res,
    req,
    context: {
      authorization: req.getHeader('authorization'),
      contentType: req.getHeader('content-type'),
      query: req.getQuery(),
      ua: req.getHeader('user-agent'),
      ip,
      id: ++clientId,
    },
  }

  client.res.writeHeader('Access-Control-Allow-Origin', '*')
  // only allowed headers
  client.res.writeHeader('Access-Control-Allow-Headers', '*')

  const name = route.name

  if (route.observable === true) {
    if (route.stream) {
      sendError(client, 'Cannot stream to observable functions', 400)
      return
    }
    const checksumRaw = req.getHeader('if-none-match')
    // @ts-ignore use isNaN to cast string to number
    const checksum = !isNaN(checksumRaw) ? Number(checksumRaw) : 0
    if (method === 'post') {
      readBody(
        client,
        (payload) => {
          authorizeRequest(server, client, payload, 'observe', name, () =>
            httpGet(name, encoding, payload, client, server, checksum)
          )
        },
        incomingEncoding,
        route.maxPayloadSize
      )
    } else {
      const payload = parseQuery(client.context.query)
      authorizeRequest(server, client, payload, 'observe', name, () =>
        httpGet(name, encoding, payload, client, server, checksum)
      )
    }
  } else {
    if (route.stream === true) {
      // only for streams
      //   fix this nice
    } else {
      if (method === 'post') {
        readBody(
          client,
          (payload) => {
            authorizeRequest(server, client, payload, 'function', name, () =>
              httpFunction(name, encoding, payload, client, server)
            )
          },
          incomingEncoding,
          route.maxPayloadSize
        )
      } else {
        const payload = parseQuery(client.context.query)
        authorizeRequest(server, client, payload, 'function', name, () =>
          httpFunction(
            name,
            encoding,
            parseQuery(client.context.query),
            client,
            server
          )
        )
      }
    }
  }
}
