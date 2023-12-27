import { BasedServer } from '../../server.js'
import { HttpSession, Context, BasedRoute } from '@based/functions'
import { readBody } from './readBody.js'
import parseQuery from './parseQuery.js'

export const handleRequest = (
  server: BasedServer,
  method: string,
  ctx: Context<HttpSession>,
  route: BasedRoute,
  ready: (payload?: any) => void
) => {
  if (method === 'post') {
    readBody(server, ctx, ready, route)
  } else {
    ready(parseQuery(ctx, route))
  }
}
