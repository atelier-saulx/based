import { Context, HttpSession } from '../../context'
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

    if (
      !ctx.session.authState &&
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
