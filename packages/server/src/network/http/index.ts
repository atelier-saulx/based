import uws from '@based/uws'
import { BasedServer } from '../../server'
import { HttpClient, isObservableFunctionSpec } from '../../types'
import { functionRest } from './function'

let clientId = 0

export const httpHandler = (
  server: BasedServer,
  req: uws.HttpRequest,
  res: uws.HttpResponse
) => {
  // no make a type 'context'

  // if no handler for path will try to read / get from functions/obs (not by name but by path)

  // default routes

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

  // const method = req.getMethod()
  // const acceptEncoding
  // const contentType = req.getHeader('content-type') || 'application/json'

  console.log(encoding)

  const url = req.getUrl()

  const path = url.split('/')

  const client: HttpClient = {
    res,
    context: {
      query,
      ua,
      ip,
      id: ++clientId,
    },
  }

  //   if (path[1] === 'get') {
  // Sending either If-Match or If-None-Match
  // only relevant for get
  // }

  if (path[1] === 'function' && path[2]) {
    // if (query)

    functionRest(path[2], undefined, encoding, client, server)
    return
  }

  if (server.functions.config.registerByPath) {
    server.functions.getByPath(url).then((spec) => {
      if (client.res) {
        return
      }
      if (!spec) {
        res.end('invalid enpoints')
      } else {
        if (isObservableFunctionSpec(spec)) {
          // get!
          res.end('get time')
        } else {
          functionRest(spec.name, undefined, encoding, client, server)
        }
      }
    })
    return
  }

  res.end('invalid endpoint')
}
