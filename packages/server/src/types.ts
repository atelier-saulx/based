import type { BasedServer } from './server'
import type uws from '@based/uws'
import { BasedErrorData } from './error'

export type ClientContext = {
  query: string
  ua: string
  ip: string
  id: number
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

export type WebsocketClient = {
  ws:
    | (uws.WebSocket &
        ClientContext & {
          obs: Set<number>
          unauthorizedObs: Set<{
            id: number
            checksum: number
            name: string
            payload: any
          }>
        })
    | null
}

export type HttpClient = {
  res: uws.HttpResponse | null
  req: uws.HttpRequest | null
  context: ClientContext | null
}

export const isHttpClient = (
  client: HttpClient | WebsocketClient
): client is HttpClient => {
  if ('res' in client) {
    return true
  }
  return false
}

export type AuthConfig = {
  authorizePath?: string
  authorizeConnection?: AuthorizeConnection
}

export type Authorize = (
  client: ClientContext,
  name: string,
  payload?: any
) => Promise<boolean>

export type AuthorizeHandshake = (
  server: BasedServer,
  client: WebsocketClient | HttpClient,
  payload?: any
) => Promise<boolean>

export type AuthorizeConnection = (req: uws.HttpRequest) => Promise<boolean>

// - FUNCTIONS IN HUB
// authorize
// authorize-advanced TODO: better name
// authorize-handshake

export type ServerOptions = {
  port?: number
  key?: string
  cert?: string
  functions?: FunctionConfig
  auth?: AuthConfig
}

export type ObservableUpdateFunction = (
  data: any,
  checksum?: number,
  diff?: any,
  fromChecksum?: number
) => void

// this gets run in the main thread
export type CustomHttpResponse = (
  result: any,
  payload: any,
  client: HttpClient
) => Promise<boolean>

export type BasedFunctionRoute = {
  name: string
  observable?: boolean
  maxPayloadSize?: number
  headers?: string[]
  path?: string
  stream?: boolean
  rateLimitTokens?: number
}

export type BasedObservableFunction = (
  payload: any,
  update: ObservableUpdateFunction
) => Promise<() => void>

export type BasedObservableFunctionSpec = BasedFunctionRoute & {
  name: string
  checksum: number
  observable: true
  functionPath: string
  stickyWorker?: string
  customHttpResponse?: CustomHttpResponse
  memCacheTimeout?: number // in ms
  idleTimeout?: number // in ms
  timeoutCounter?: number
}

export type BasedFunction = (
  payload: any,
  client: ClientContext
) => Promise<any>

export type BasedFunctionSpec = BasedFunctionRoute & {
  name: string
  customHttpResponse?: CustomHttpResponse
  checksum: number
  stickyWorker?: string
  functionPath: string
  maxExecTime?: number // in ms - very nice too have
  idleTimeout?: number // in ms
  timeoutCounter?: number // in ms
}

export type FunctionConfig = {
  memCacheTimeout?: number // in ms
  idleTimeout?: number // in ms
  maxWorkers?: number
  functionApiWrapperPath?: string

  route: (opts: {
    server: BasedServer
    name?: string
    path?: string
  }) => false | BasedFunctionRoute

  install: (opts: {
    server: BasedServer
    name: string
  }) => Promise<false | BasedObservableFunctionSpec | BasedFunctionSpec>

  uninstall: (opts: {
    server: BasedServer
    name: string
    function: BasedObservableFunctionSpec | BasedFunctionSpec
  }) => Promise<boolean>

  log?: (opts: {
    server: BasedServer
    type: 'error' | 'warn' | 'info' | 'log'
    name: string
    message: string
    callstack: string[]
  }) => void
}

export function isObservableFunctionSpec(
  fn: BasedObservableFunctionSpec | BasedFunctionSpec
): fn is BasedObservableFunctionSpec {
  return (fn as BasedObservableFunctionSpec).observable
}

export type ActiveObservable = {
  name: string
  id: number
  clients: Set<number>
  isDestroyed: boolean
  payload: any
  diffCache?: Uint8Array
  cache?: Uint8Array
  previousChecksum?: number
  isDeflate?: boolean
  checksum?: number
  closeFunction?: () => void
  beingDestroyed?: NodeJS.Timeout
  onNextData?: Set<() => void>
}

export type EventMap = {
  error: BasedErrorData
  ratelimit: void
}

export type Event = keyof EventMap

export type Listener<T> = (
  client: HttpClient | WebsocketClient,
  data?: T
) => void
