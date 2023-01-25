import { AuthConfig, Authorize, VerifyAuthState } from './types'

export const dummyAuthorize: Authorize = async () => {
  // console.warn(' 🔓 Dummy auth', name, payload)
  return true
}

export const dummyVerifyAuthState: VerifyAuthState = (server, ctx) => {
  console.warn(' 🔍 Dummy verify', ctx.session.authState)
  return true
}

export const dummyConfig: AuthConfig = {
  authorize: dummyAuthorize,
  verifyAuthState: dummyVerifyAuthState,
}
