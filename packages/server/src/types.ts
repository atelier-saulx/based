import type { BasedServer } from './server'
import type uws from '@based/uws'
import { BasedErrorData } from './error'

export type WebsocketClient = {
  ws:
    | (uws.WebSocket & {
        query: string
        ua: string
        ip: string
        authState?: any
        id: number
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
  context:
    | ({
        authState?: any
        headers: {
          'content-length'?: number
          authorization?: string
          'content-type'?: string
          'content-encoding'?: string
          encoding?: string
        } & { [key: string]: string }
        ua: string
        ip: string
        id: number
      } & { [contextField: string]: any })
    | null
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
  authorize?: Authorize
  authHandshake?: AuthorizeHandshake
  authorizeConnection?: AuthorizeConnection
}

export type Authorize = (
  server: BasedServer,
  client: WebsocketClient | HttpClient,
  name: string,
  payload?: any
) => Promise<boolean>

export type AuthorizeHandshake = (
  server: BasedServer,
  client: WebsocketClient | HttpClient,
  payload?: any
) => Promise<boolean>

export type AuthorizeConnection = (req: uws.HttpRequest) => Promise<boolean>

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

export type BasedObservableFunctionSpec = BasedFunctionRoute & {
  name: string
  checksum: number
  observable: true
  function: (
    payload: any,
    update: ObservableUpdateFunction
  ) => Promise<() => void>
  customHttpResponse?: CustomHttpResponse
  memCacheTimeout?: number // in ms
  idleTimeout?: number // in ms
  worker?: string | true | false
  timeoutCounter?: number // bit harder have to add
}

export type BasedFunctionSpec = BasedFunctionRoute & {
  name: string
  customHttpResponse?: CustomHttpResponse
  checksum: number
  function: (payload: any, client: WebsocketClient | HttpClient) => Promise<any>
  idleTimeout?: number // in ms
  worker?: boolean | true | false
  timeoutCounter?: number
}

export type FunctionConfig = {
  memCacheTimeout?: number // in ms
  idleTimeout?: number // in ms
  maxWorkers?: number

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
  payload: any
  isDestroyed: boolean
  rawData?: any // deepCopy
  rawDataSize?: number
  diffCache?: Uint8Array
  previousChecksum?: number
  cache?: Uint8Array // will become SharedArrayBuffer
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
