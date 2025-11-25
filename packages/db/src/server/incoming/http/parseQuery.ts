import type {
  BasedRoute,
  Context,
  HttpSession,
} from '../../../functions/index.js'
import { parseQuery } from '../../../utils/index.js'
import { parseAuthState } from '../../auth/index.js'

export default (
  ctx: Context<HttpSession>,
  route: BasedRoute,
): ReturnType<typeof parseQuery> => {
  if (!('query' in ctx.session!)) {
    return
  }
  if ('parsedQuery' in ctx.session) {
    return ctx.session.parsedQuery
  }
  try {
    ctx.session.parsedQuery = parseQuery(ctx.session.query!)
    // TODO check if this is a good idea (can also call it 'authState')
    if (
      !ctx.session.authState.token &&
      !ctx.session.authState.refreshToken &&
      ctx.session.parsedQuery &&
      'token' in ctx.session.parsedQuery
    ) {
      ctx.session.authState = parseAuthState(ctx.session.parsedQuery.token)
      if (route.type === 'query') {
        delete ctx.session.parsedQuery.token
      }
    }
    return ctx.session.parsedQuery
  } catch (err) {
    ctx.session.parsedQuery = undefined
  }
}
