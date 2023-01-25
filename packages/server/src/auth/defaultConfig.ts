import { Authorize, VerifyAuthState } from './types'

export const defaultAuthorize: Authorize = async () => {
  return true
}

export const defaultVerifyAuthState: VerifyAuthState = () => {
  return true
}
