import {
  Context,
  HttpSession,
  WebSocketSession,
  AuthState,
} from '@based/functions'
import uws from '@based/uws'
import { BasedServer } from '../server'

export type AuthConfig = {
  authorize?: Authorize
  authorizeConnection?: AuthorizeConnection
  verifyAuthState?: VerifyAuthState
}

export type Authorize = (
  server: BasedServer,
  context: Context<HttpSession | WebSocketSession>,
  name: string,
  payload?: any
) => Promise<boolean>

// True - its the same all good
// AuthState - new auth state send it
//    if error send error state (and reject)
export type VerifyAuthState = (
  server: BasedServer,
  context: Context<HttpSession | WebSocketSession>,
  authState: AuthState
) => true | AuthState

export type AuthorizeConnection = (
  server: BasedServer,
  req: uws.HttpRequest
) => Promise<boolean>
