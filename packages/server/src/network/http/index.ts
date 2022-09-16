import uws from '@based/uws'
import { BasedServer } from '../../server'
import { HttpClient, isObservableFunctionSpec } from '../../types'
import { functionRest } from './function'
import { getRest } from './get'
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
    console.info('ABORT')
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
  const url = req.getUrl()
  const path = url.split('/')
  const method = req.getMethod()

  const client: HttpClient = {
    res,
    context: {
      query,
      ua,
      ip,
      id: ++clientId,
    },
  }

  if (path[1] === 'get') {
    if (method === 'post') {
      readPostData(client, contentType, (payload) => {
        getRest(path[2], payload, encoding, client, server)
      })
    } else {
      getRest(path[2], parseQuery(query), encoding, client, server)
    }
    return
  }

  if (path[1] === 'function' && path[2]) {
    if (method === 'post') {
      readPostData(client, contentType, (payload) => {
        functionRest(path[2], payload, encoding, client, server)
      })
    } else {
      functionRest(path[2], parseQuery(query), encoding, client, server)
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
          getRest(spec.name, parseQuery(query), encoding, client, server)
        } else {
          if (method === 'post') {
            readPostData(client, contentType, (payload) => {
              functionRest(spec.name, payload, encoding, client, server)
            })
          } else {
            functionRest(spec.name, parseQuery(query), encoding, client, server)
          }
        }
      }
    })
    return
  }

  sendError(client, 'Bad request')
}
