import { Context, HttpSession, WebSocketSession } from '../context'
import uws from '@based/uws'

export type AuthState = {
  token?: string
  userId?: string
  refreshToken?: string
  error?: string
  persistent?: boolean
  type?: string
}

export type AuthConfig = {
  authorize?: Authorize
  authorizeConnection?: AuthorizeConnection
  verifyAuthState?: VerifyAuthState
}

export type Authorize = (
  context: Context<HttpSession | WebSocketSession>,
  name: string,
  payload?: any
) => Promise<boolean>

// True - its the same all good
// AuthState - new auth state send it
//    if error send error state (and reject)
export type VerifyAuthState = (
  context: Context<HttpSession | WebSocketSession>,
  authState: AuthState
) => true | AuthState

export type AuthorizeConnection = (req: uws.HttpRequest) => Promise<boolean>
