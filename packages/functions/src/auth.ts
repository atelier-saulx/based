import { BasedFunctionClient } from './client.js'
import { HttpRequest } from './uws.js'
import { Context, WebSocketSession, HttpSession } from './context.js'

export type AuthState = {
  token?: string
  userId?: string | number
  refreshToken?: string
  error?: string
  persistent?: boolean
  type?: string
  t?: 0 | 1
  v?: 2
}

export type Authorize = (
  based: BasedFunctionClient,
  context: Context<HttpSession | WebSocketSession>,
  name: string, // name as generic dope
  payload?: any,
) => Promise<boolean>

// True - its the same all good
// AuthState - new auth state send it
//    if error send error state (and reject)
export type VerifyAuthState = (
  based: BasedFunctionClient,
  context: Context<HttpSession | WebSocketSession>,
  authState: AuthState,
) => Promise<true | AuthState>

export type AuthorizeConnection = (
  based: BasedFunctionClient,
  req: HttpRequest,
  ip: string,
) => Promise<boolean>
