import { AuthState } from './auth'
import { WebSocket, HttpRequest, HttpResponse } from './uws'
import { parseQuery } from '@saulx/utils'
import { BasedFunctionClient } from './client'

export type WebSocketSession = {
  // State can be used for anyting - for us the based class instance
  state?: any
  query: string
  ua: string
  ip: string
  id: number // client-id
  method: string
  authState: AuthState
  obs: Set<number>
  unauthorizedObs: Set<{
    id: number
    checksum: number
    name: string
    payload: any
  }>
  // Optimization so we dont need to keep track of websockets outside of uws
  c?: Context<WebSocketSession>
} & WebSocket

export type HttpSession = {
  // State can be used for anyting - for us the based class instance
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
  type: 'observable'
}

export type InternalSessionClient = {
  client: BasedFunctionClient
  type: 'client'
}

// Internal session for internal functions
export type InternalSession = InternalSessionClient | InternalSessionObservable

// used for minimal security errors (e.g. rate limit)
export type MinimalExternalSession = {
  ua: string
  ip: string
}

export type Context<
  S extends
    | WebSocketSession
    | HttpSession
    | InternalSession
    | MinimalExternalSession =
    | WebSocketSession
    | HttpSession
    | InternalSession
    | MinimalExternalSession
> = {
  session?: S
}

export const isHttpContext = (
  ctx: Context<HttpSession | WebSocketSession>
): ctx is Context<HttpSession> => {
  if ('res' in ctx?.session) {
    return true
  }
  return false
}

export const isWsContext = (
  ctx: Context<HttpSession | WebSocketSession>
): ctx is Context<WebSocketSession> => {
  if (ctx.session && !('res' in ctx.session)) {
    return true
  }
  return false
}

export const isWsSession = (
  session: HttpSession | WebSocketSession
): session is WebSocketSession => {
  if (!('res' in session)) {
    return true
  }
  return false
}
