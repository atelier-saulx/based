import { BasedServer } from '../../server.js'
import { HttpSession, Context, BasedRoute } from '@based/functions'
import { readBody } from './readBody.js'
import parseQuery from './parseQuery.js'
import payloadParser from './payloadParser.js'

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
    const payload = payloadParser(ctx, route)

    console.log({handleRequest: payload});
    
    ready({})
    
    // const pathPattern = route.path || ''
    // const requestedPath = ctx.session.url.replace(`/${route.name}`, '')

    // ready({
    //   ...parsePath(pathPattern, requestedPath, false, true),
    //   ...parseQuery(ctx, route)
    // })
  }
}
