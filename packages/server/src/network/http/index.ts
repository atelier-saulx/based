import uws from '@based/uws'
import { BasedServer } from '../../server'
import { HttpClient, isObservableFunctionSpec } from '../../types'
import { httpFunction } from './function'
import { httpGet } from './get'
import { parseQuery } from '@saulx/utils'
import { sendError } from './sendError'

let clientId = 0

// these can be stored on context
const allowedHeaders = [
  'x-forwarded-for',
  'user-agent',
  'authorization',
  'accept',
  'accept-language',
  'accept-encoding',
  'referer',
  'connection',
  'upgrade-insecure-requests',
  'if-modified-since',
  'if-none-match',
  'cache-control',
  'host',
  'origin',
  'pragma',
]

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

  console.info('request go go go')
  // make it different

  sendError(client, 'Bad request')
}
