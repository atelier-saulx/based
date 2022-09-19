import uws from '@based/uws'
import { BasedServer } from '../../server'
import { HttpClient, isObservableFunctionSpec } from '../../types'
import { httpFunction } from './function'
import { httpGet } from './get'
import readPostData from './readPostData'
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

  const url = req.getUrl()
  const path = url.split('/')
  const method = req.getMethod()

  const client: HttpClient = {
    res,
    context: {
      authorization,
      query,
      ua,
      ip,
      id: ++clientId,
    },
  }

  client.res.writeHeader('Access-Control-Allow-Origin', '*')
  client.res.writeHeader(
    'Access-Control-Allow-Headers',
    'Content-Encoding, If-None-Match, Content-Type, Authorization, Content-Length, File-Is-Raw, File-Extension, File-Name, File-Id'
  )

  // check for headers
  // add a function updateStream or something
  // maybe make a special 'stream' function ? < - think this is the best

  if (path[1] === 'get') {
    const checksumRaw = req.getHeader('if-none-match')
    // @ts-ignore use isnan to cast string to number
    const checksum = !isNaN(checksumRaw) ? Number(checksumRaw) : 0

    if (method === 'post') {
      readPostData(client, contentType, (payload) => {
        httpGet(path[2], payload, encoding, client, server, checksum)
      })
    } else {
      httpGet(path[2], parseQuery(query), encoding, client, server, checksum)
    }
    return
  }

  if (path[1] === 'function' && path[2]) {
    if (method === 'post') {
      readPostData(client, contentType, (payload) => {
        httpFunction(path[2], payload, encoding, client, server)
      })
    } else {
      httpFunction(path[2], parseQuery(query), encoding, client, server)
    }
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
          httpGet(
            spec.name,
            parseQuery(query),
            encoding,
            client,
            server,
            checksum
          )
        } else {
          if (method === 'post') {
            readPostData(client, contentType, (payload) => {
              httpFunction(spec.name, payload, encoding, client, server)
            })
          } else {
            httpFunction(spec.name, parseQuery(query), encoding, client, server)
          }
        }
      }
    })
    return
  }

  sendError(client, 'Bad request')
}
