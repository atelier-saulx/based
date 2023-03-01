import { AuthState } from './auth'
import { WebSocket, HttpRequest, HttpResponse } from './uws'
import { parseQuery } from '@saulx/utils'
import { BasedFunctionClient } from './client'

export type WebSocketSession = {
  // State can be used for anything - for us the based class instance
  state?: any
  query: string
  ua: string
  ip: string
  id: number // client-id
  method: string
  authState: AuthState
  obs: Set<number>
  unauthorizedObs?: Set<{
    id: number
    checksum: number
    name: string
    payload: any
  }>
  headers: { [key: string]: string }
  unauthorizedChannels?: Set<{
    id: number
    name: string
    payload: any
  }>
  // Optimization so we dont need to keep track of websockets outside of uws
  c?: Context<WebSocketSession>
  ws?: BasedWebSocket
}

export type BasedWebSocket = WebSocket<WebSocketSession>

export type HttpSession = {
  // State can be used for anything - for us the based class instance
  state?: any
  res: HttpResponse
  req: HttpRequest
  query?: string
  parsedQuery?: ReturnType<typeof parseQuery>
  ua: string
  ip: string
  id: number // client-id
  authState: AuthState
  method: string
  corsSend?: boolean
  headers: {
    'content-length'?: number
    'content-type'?: string
    'content-encoding'?: string
    encoding?: string
  } & { [key: string]: string }
}

export type InternalSessionObservable = {
  id: number
  name: string
  headers: { [key: string]: string }
  type: 'query'
}

export type InternalSessionChannel = {
  id: number
  name: string
  headers: { [key: string]: string }
  type: 'channel'
}

export type InternalSessionClient = {
  client: BasedFunctionClient
  headers: { [key: string]: string }
  type: 'client'
}

// Internal session for internal functions
export type InternalSession =
  | InternalSessionClient
  | InternalSessionObservable
  | InternalSessionChannel

// used for minimal security errors (e.g. rate limit)
export type MinimalExternalSession = {
  ua: string
  ip: string
  headers: { [key: string]: string }
}

export type Session = (
  | WebSocketSession
  | HttpSession
  | InternalSession
  | MinimalExternalSession
) & {
  /** Only available in Ws and Http contexts */
  authState?: AuthState
}

export type Context<S extends Session = Session> = {
  session?: S
}

export const isHttpContext = (
  ctx: Context<Session>
): ctx is Context<HttpSession> => {
  if ('res' in ctx?.session) {
    return true
  }
  return false
}

export const isWsContext = (
  ctx: Context<Session>
): ctx is Context<WebSocketSession> => {
  if (ctx.session && isWsSession(ctx.session)) {
    return true
  }
  return false
}

export const isClientContext = (
  ctx: Context<Session>
): ctx is Context<WebSocketSession | HttpSession> => {
  if (ctx.session && (isWsSession(ctx.session) || isHttpSession(ctx.session))) {
    return true
  }
  return false
}

export const isHttpSession = (session: Session): session is HttpSession => {
  if ('res' in session) {
    return true
  }
  return false
}

export const isWsSession = (session: Session): session is WebSocketSession => {
  if ('send' in session) {
    return true
  }
  return false
}
