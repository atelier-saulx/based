import uws from '@based/uws'
import { BasedServer } from '../../server'
import { HttpClient, isObservableFunctionSpec } from '../../types'
import { httpFunction } from './function'
import { httpGet } from './get'
import { parseQuery } from '@saulx/utils'
import { sendError } from './sendError'

let clientId = 0

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

  const query = req.getQuery()
  const ua = req.getHeader('user-agent')
  // ip is 39 bytes - (adds 312kb for 8k clients to mem)
  const ip =
    req.getHeader('x-forwarded-for') ||
    Buffer.from(res.getRemoteAddressAsText()).toString()

  const encoding = req.getHeader('accept-encoding')
  const contentType = req.getHeader('content-type') || 'application/json'
  const authorization = req.getHeader('authorization')

  // const size = Number(req.getHeader('content-length'))
  // lets think about it
  // const customPayload = req.getHeader('payload')
  // not a lot of headers...

  // Bearer cn389ncoiwuencr

  // GET /home.html HTTP/1.1
  // Host: developer.mozilla.org
  // User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.9; rv:50.0) Gecko/20100101 Firefox/50.0
  // Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
  // Accept-Language: en-US,en;q=0.5
  // Accept-Encoding: gzip, deflate, br
  // Referer: https://developer.mozilla.org/testpage.html
  // Connection: keep-alive
  // Upgrade-Insecure-Requests: 1
  // If-Modified-Since: Mon, 18 Jul 2016 02:36:04 GMT
  // If-None-Match: "c561c68d0ba92bbeb8b0fff2a9199f722e3a621a"
  // Cache-Control: max-age=0

  const url = req.getUrl()
  const path = url.split('/')
  const method = req.getMethod()

  const client: HttpClient = {
    res,
    req,
    context: {
      authorization,
      contentType,
      query: parseQuery(query),
      ua,
      ip,
      id: ++clientId,
    },
  }

  client.res.writeHeader('Access-Control-Allow-Origin', '*')
  // maybe a bit more specific
  client.res.writeHeader('Access-Control-Allow-Headers', '*')

  // and then also speicfic for the return headers

  // query parsing for files? for extra fields?

  // options
  // allow all headers?
  // select headers ALSO for return!

  if (path[1] === 'get') {
    const checksumRaw = req.getHeader('if-none-match')
    // @ts-ignore use isNaN to cast string to number
    const checksum = !isNaN(checksumRaw) ? Number(checksumRaw) : 0
    httpGet(path[2], encoding, client, server, checksum, method)
    return
  }

  if (path[1] === 'function' && path[2]) {
    httpFunction(path[2], encoding, client, server, method)
    return
  }

  if (server.functions.config.registerByPath) {
    server.functions.getByPath(url).then((spec) => {
      if (!client.res) {
        return
      }
      if (!spec) {
        sendError(client, `'${url}' does not exist`, 404, 'Not Found')
      } else {
        if (isObservableFunctionSpec(spec)) {
          const checksumRaw = req.getHeader('if-none-match')
          // @ts-ignore use isnan to cast string to number
          const checksum = !isNaN(checksumRaw) ? Number(checksumRaw) : 0
          httpGet(spec.name, encoding, client, server, checksum, method)
        } else {
          httpFunction(spec.name, encoding, client, server, method)
        }
      }
    })
    return
  }

  sendError(client, 'Bad request')
}
