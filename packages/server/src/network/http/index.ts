import uws from '@based/uws'
import { BasedServer } from '../../server'
import { HttpClient, isObservableFunctionSpec } from '../../types'
import { functionRest } from './function'
import end from './end'
import readPostData from './readPostData'

let clientId = 0

const readQuery = (query: string): any => {
  if (query) {
    console.log('go go go query', query)
  }
  // x
}

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

  // if (path[1] === 'get') {
  // Sending either If-Match or If-None-Match
  // only relevant for get

  // Parse body
  //
  // const acceptEncoding
  //
  // }

  // parse payload

  if (path[1] === 'function' && path[2]) {
    if (method === 'post') {
      readPostData(client, contentType, (payload) => {
        functionRest(path[2], payload, encoding, client, server)
      })
    } else {
      functionRest(path[2], readQuery(query), encoding, client, server)
    }

    return
  }

  if (server.functions.config.registerByPath) {
    server.functions.getByPath(url).then((spec) => {
      if (!client.res) {
        return
      }
      if (!spec) {
        end(client, 'invalid enpoints')
      } else {
        if (isObservableFunctionSpec(spec)) {
          // get!
          end(client, 'get time')
        } else {
          if (method === 'post') {
            readPostData(client, contentType, (payload) => {
              functionRest(path[2], payload, encoding, client, server)
            })
          } else {
            functionRest(path[2], readQuery(query), encoding, client, server)
          }
        }
      }
    })
    return
  }

  res.end('invalid endpoint')
}
