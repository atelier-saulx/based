import { Context, HttpSession, BasedRoute } from '@based/functions'
import { parseAuthState } from '../../auth/index.js'
import { pathExtractor } from './pathMatcher.js'

export default (
  ctx: Context<HttpSession>,
  route: BasedRoute
) => {
  const payload = pathExtractor(route.path, ctx.session.url)

  console.log({payload});
  

  if ('token' in payload) {
    ctx.session.authState = parseAuthState(payload.token)
    
    if (route.type === 'query') {
      delete payload.token
    }
  }

  return payload
}