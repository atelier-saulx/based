import { Authorize, VerifyAuthState } from '@based/functions'
import { deepEqual } from '@saulx/utils'

export const defaultAuthorize: Authorize = async () => {
  return true
}

export const defaultVerifyAuthState: VerifyAuthState = async (
  based,
  ctx,
  authState
) => {
  if (ctx.session && !deepEqual(authState, ctx.session.authState)) {
    return authState
  }
  return true
}
