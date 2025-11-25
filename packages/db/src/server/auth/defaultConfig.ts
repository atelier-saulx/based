import { Authorize, VerifyAuthState } from '../../functions/index.js'
import { deepEqual } from '../../utils/index.js'

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
