import uws from '@based/uws'
import { BasedServer } from '../../server'
import { RestClient, isObservableFunctionSpec } from '../../types'
import { functionRest } from './function'

let clientId = 0

export const rest = (
  server: BasedServer,
  req: uws.HttpRequest,
  res: uws.HttpResponse
) => {
  // no make a type 'context'
  res.onAborted(() => {
    client.isAborted = true
    console.info('abort...', client.id)
  })
  // if no handler for path will try to read / get from functions/obs (not by name but by path)

  // default routes

  const query = req.getQuery()
  const ua = req.getHeader('user-agent')
  // ip is 39 bytes - (adds 312kb for 8k clients to mem)
  const ip =
    req.getHeader('x-forwarded-for') ||
    Buffer.from(res.getRemoteAddressAsText()).toString()

  const url = req.getUrl()

  // function/:name
  // get/:name

  const path = url.split('/')

  const client: RestClient = {
    res,
    query,
    ua,
    ip,
    id: ++clientId,
  }

  // have to allow "get" as well
  if (path[1] === 'function' && path[2]) {
    functionRest(path[2], undefined, false, client, server)
    return
  }

  if (server.functions.config.registerByPath) {
    server.functions.getByPath(url).then((spec) => {
      if (client.isAborted) {
        return
      }
      if (!spec) {
        res.end('invalid enpoints')
      } else {
        if (isObservableFunctionSpec(spec)) {
          // get!
          res.end('get time')
        } else {
          functionRest(spec.name, undefined, false, client, server)
        }
      }
    })
    return
  }

  //   if (path[1] === 'get') {

  // }

  res.end('invalid endpoint')
}
