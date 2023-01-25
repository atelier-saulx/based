import { BasedServer } from '../server'
import { Context, HttpSession, WebSocketSession } from '../context'
import uws from '@based/uws'

export type AuthState = {
  token?: string
  userId?: string
  refreshToken?: string
  error?: string
  persistent?: boolean
}

export type AuthConfig = {
  authorize?: Authorize
  authorizeConnection?: AuthorizeConnection
}

export type Authorize = (
  context: Context<HttpSession | WebSocketSession>,
  name: string,
  payload?: any
) => Promise<boolean>

export type AuthorizeHandshake = (
  server: BasedServer,
  context: Context<HttpSession | WebSocketSession>,
  payload?: any
) => Promise<boolean>

export type AuthorizeConnection = (req: uws.HttpRequest) => Promise<boolean>
