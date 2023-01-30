import { Context, HttpSession } from '@based/functions'
import { parseQuery } from '@saulx/utils'
import { parseAuthState } from '../../auth'

export default (ctx: Context<HttpSession>): ReturnType<typeof parseQuery> => {
  if (!('query' in ctx.session)) {
    return
  }
  if ('parsedQuery' in ctx.session) {
    return ctx.session.parsedQuery
  }
  try {
    ctx.session.parsedQuery = parseQuery(ctx.session.query)

    // TODO chekc if this is a good idea (can also call it 'autState')
    if (
      !ctx.session.authState.token &&
      !ctx.session.authState.refreshToken &&
      ctx.session.parsedQuery &&
      'token' in ctx.session.parsedQuery
    ) {
      ctx.session.authState = parseAuthState(ctx.session.parsedQuery.token)
    }

    return ctx.session.parsedQuery
  } catch (err) {
    ctx.session.parsedQuery = undefined
  }
}
