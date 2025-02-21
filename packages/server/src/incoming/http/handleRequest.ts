import { BasedServer } from '../../server.js'
import { HttpSession, Context, BasedRouteComplete } from '@based/functions'
import { readBody } from './readBody.js'
import parseQuery from './parseQuery.js'
import payloadParser from './payloadParser.js'

export const handleRequest = (
  server: BasedServer,
  method: string,
  ctx: Context<HttpSession>,
  route: BasedRouteComplete,
  ready: (payload?: any) => void
) => {
  if (method === 'post') {
    readBody(server, ctx, ready, route)
  } else {
    const payload = payloadParser(ctx, route)
    
    ready(payload)
  }
}
