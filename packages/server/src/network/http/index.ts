import uws from '@based/uws'
import { BasedServer } from '../../server'
import { HttpClient, isObservableFunctionSpec } from '../../types'
import { functionRest } from './function'
import end from './end'
import readPostData from './readPostData'
import qs from 'node:querystring'

let clientId = 0

type QueryValue = string | number | boolean

const parseQueryValue = (q: any): QueryValue | QueryValue[] => {
  if (Array.isArray(q)) {
    for (let i = 0; i < q.length; i++) {
      q[i] = parseQueryValue(q[i])
    }
    return q
  }
  if (q === 'null') {
    return null
  } else if (q === 'true') {
    return true
  } else if (q === 'false') {
    return false
    // @ts-ignore doing a typecheck...
  } else if (typeof q === 'string' && /^\d+$/.test(q)) {
    return Number(q)
  }

  return q
}

const readQuery = (query: string): any => {
  // TODO parse it yourself - and improve PERF!
  if (query) {
    try {
      const r: { [key: string]: QueryValue | QueryValue[] } = {}
      const p = qs.parse(query)
      for (const k in p) {
        r[k] = parseQueryValue(p[k])
      }
      return r
    } catch (_e) {}
  }
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
              functionRest(spec.name, payload, encoding, client, server)
            })
          } else {
            functionRest(spec.name, readQuery(query), encoding, client, server)
          }
        }
      }
    })
    return
  }

  res.end('invalid endpoint')
}
