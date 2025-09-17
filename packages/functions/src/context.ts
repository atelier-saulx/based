import { parseQuery } from '@based/utils'
import { AuthState } from './auth.js'
import { WebSocket, HttpRequest, HttpResponse } from './uws.js'
import { BasedFunctionClient } from './client.js'
import { BasedRoute, StreamPayload } from './functions.js'

export type WebSocketSession = {
  // State can be used for anything - for us the based class instance
  state?: any
  query: string
  ua: string
  ip: string
  id: number // client-id
  method: string
  authState: AuthState
  type: '0' | '1'
  origin: string
  obs: Set<number>
  unauthorizedObs?: Set<{
    id: number
    checksum: number
    route: BasedRoute<'query'>
    payload: any
  }>
  unauthorizedChannels?: Set<{
    id: number
    route: BasedRoute<'channel'>
    payload: any
  }>
  attachedCtxObs?: Set<number>
  streams?: { [reqId: string]: StreamPayload }
  headers: { [key: string]: string }
  v?: 2
  // Optimization so we dont need to keep track of websockets outside of uws
  c?: Context<WebSocketSession>
  ws?: BasedWebSocket
}

export type BasedWebSocket = WebSocket<WebSocketSession>

export type HttpSession = {
  // State can be used for anything - for us the based class instance
  state?: any
  res: HttpResponse
  url: string
  origin: string
  req: HttpRequest
  query?: string
  parsedQuery?: ReturnType<typeof parseQuery>
  ua: string
  ip: string
  id: number // client-id
  authState: AuthState
  method: string
  rawBody?: string
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
  origin?: string

  /** Only available in Ws and Http contexts */
  authState?: AuthState
}

export type Context<S extends Session = Session> = {
  session?: S
}

export const isHttpContext = (
  ctx: Context<Session>,
): ctx is Context<HttpSession> => {
  if ('res' in ctx?.session) {
    return true
  }
  return false
}

export const isWsContext = (
  ctx: Context<Session>,
): ctx is Context<WebSocketSession> => {
  if (ctx.session && isWsSession(ctx.session)) {
    return true
  }
  return false
}

export const isClientContext = (
  ctx: Context<Session>,
): ctx is Context<WebSocketSession | HttpSession> => {
  if (ctx.session && (isWsSession(ctx.session) || isHttpSession(ctx.session))) {
    return true
  }
  return false
}

export const isHttpSession = (
  session: Session | undefined,
): session is HttpSession => {
  if (session && 'res' in session) {
    return true
  }
  return false
}

export const isWsSession = (
  session: Session | undefined,
): session is WebSocketSession => {
  if (session && 'send' in session) {
    return true
  }
  return false
}
