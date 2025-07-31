import { Authorize, VerifyAuthState } from '@based/functions'
import { deepEqual } from '@based/utils'

export const defaultAuthorize: Authorize = async () => {
  return true
}

export const defaultVerifyAuthState: VerifyAuthState = async (
  _,
  ctx,
  authState,
) => {
  if (ctx.session && !deepEqual(authState, ctx.session.authState)) {
    return authState
  }
  return true
}
