import { Authorize, VerifyAuthState } from '@based/functions'

export const defaultAuthorize: Authorize = async () => {
  return true
}

export const defaultVerifyAuthState: VerifyAuthState = async () => {
  return true
}
