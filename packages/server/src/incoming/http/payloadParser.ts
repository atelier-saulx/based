import { Context, HttpSession, BasedRouteComplete } from '@based/functions'
import { parseAuthState } from '../../auth/index.js'
import { pathExtractor } from './pathMatcher.js'

export default (ctx: Context<HttpSession>, route: BasedRouteComplete) => {
  let url = ctx.session.url
  const query = ctx.session.query ? '?' + ctx.session.query : ''

  if (url.charCodeAt(url.length - 1) !== 47 && query) {
    url += '/'
  }

  url += query

  if (!url.startsWith(`/${route.name}`)) {
    url = `/${route.name}${url}`
  }

  const payload = pathExtractor(route.tokens, Buffer.from(url))

  if (payload && 'token' in payload) {
    ctx.session.authState = parseAuthState(payload.token)

    if (route.type === 'query') {
      delete payload.token
    }
  }

  return payload
}
