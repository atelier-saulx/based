import uws from '@based/uws'

export type WebSocketSession = {
  state?: any
  user?: string
  query: string
  ua: string
  ip: string
  id: number // client-id
  method: string
  authState?: any
  obs: Set<number>
  unauthorizedObs: Set<{
    id: number
    checksum: number
    name: string
    payload: any
  }>
} & uws.WebSocket

export type HttpSession = {
  res: uws.HttpResponse
  req: uws.HttpRequest
  state?: any
  user?: string
  query?: string
  ua: string
  ip: string
  id: number // client-id
  authState?: any
  method: string
  headers: {
    'content-length'?: number
    authorization?: string
    'content-type'?: string
    'content-encoding'?: string
    encoding?: string
  } & { [key: string]: string }
}

// Observable session means the first observable that called the current stack
export type ObservableSession = { id: number; state?: any }

// used for minimal security errors (rate limit for example)
export type MinimalExternalSession = {
  ua: string
  ip: string
}

// State can be used for anyting - for us the based class instance
export type Context<
  S extends
    | WebSocketSession
    | HttpSession
    | ObservableSession
    | MinimalExternalSession =
    | WebSocketSession
    | HttpSession
    | ObservableSession
    | MinimalExternalSession
> = {
  callStack?: string[]
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

export const isWsSession = (
  session: HttpSession | WebSocketSession
): session is WebSocketSession => {
  if (!('res' in session)) {
    return true
  }
  return false
}
