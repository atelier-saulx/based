import { BasedFunctionClient } from './client'
import { HttpRequest } from './uws'
import { Context, WebSocketSession, HttpSession } from './context'

export type AuthState = {
  token?: string
  userId?: string
  refreshToken?: string
  error?: string
  persistent?: boolean
  type?: string
}

export type Authorize = (
  based: BasedFunctionClient,
  context: Context<HttpSession | WebSocketSession>,
  name: string, // name as generic dope
  payload?: any
) => Promise<boolean>

// True - its the same all good
// AuthState - new auth state send it
//    if error send error state (and reject)
export type VerifyAuthState = (
  based: BasedFunctionClient,
  context: Context<HttpSession | WebSocketSession>,
  authState: AuthState
) => Promise<true | AuthState>

export type AuthorizeConnection = (
  based: BasedFunctionClient,
  req: HttpRequest
) => Promise<boolean>
