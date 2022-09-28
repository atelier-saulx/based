import uws from '@based/uws'
import { BasedServer } from '../../server'
import { HttpClient } from '../../types'
import { httpFunction } from './function'
import { httpGet } from './get'
import { parseQuery } from '@saulx/utils'
import { readBody } from './readBody'
import { sendError } from './sendError'

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
    res.writeStatus(`429 Too Many Requests`)
    res.writeHeader('Access-Control-Allow-Origin', '*')
    res.writeHeader('Access-Control-Allow-Headers', 'content-type')
    res.writeHeader('Content-Type', 'text/plain')
    res.end('Too Many Requests')
    return
  }

  const url = req.getUrl()
  const path = url.split('/')

  const route = server.functions.route(path[1], url)

  if (route === false) {
    res.writeStatus(`404 Not Found`)
    res.writeHeader('Access-Control-Allow-Origin', '*')
    res.writeHeader('Access-Control-Allow-Headers', 'content-type')
    res.writeHeader('Content-Type', 'text/plain')
    res.end('404 Not Found')
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
        (d) => {
          httpGet(name, encoding, d, client, server, checksum)
          // go time
        },
        incomingEncoding,
        route.maxPayloadSize
      )
    } else {
      httpGet(
        name,
        encoding,
        parseQuery(client.context.query),
        client,
        server,
        checksum
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
          (d) => {
            httpFunction(name, encoding, d, client, server)
            // go time
          },
          incomingEncoding,
          route.maxPayloadSize
        )
      } else {
        httpFunction(
          name,
          encoding,
          parseQuery(client.context.query),
          client,
          server
        )
      }
    }
  }
}
