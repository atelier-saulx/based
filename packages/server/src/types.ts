import type { BasedServer } from './server'
import type uws from '@based/uws'

export type AuthConfig = {
  authorize?: Authorize
  authHandshake?: AuthorizeHandshake
  authorizeConnection?: AuthorizeConnection
}

export type Authorize = (
  server: BasedServer,
  ws: uws.WebSocket,
  type: 'observe' | 'function',
  name: string,
  payload?: any
) => Promise<boolean>

export type AuthorizeHandshake = (
  server: BasedServer,
  ws: uws.WebSocket,
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

export type BasedObservableFunctionSpec = {
  name: string
  checksum: number
  observable: true
  function: (
    payload: any,
    update: ObservableUpdateFunction
  ) => Promise<() => void>
  memCacheTimeout?: number // in ms
  idleTimeout?: number // in ms
  worker?: string | true | false
  timeoutCounter?: number // bit harder have to add
}

export type BasedFunctionSpec = {
  name: string
  checksum: number
  function: (payload: any, ws: uws.WebSocket) => Promise<any>
  idleTimeout?: number // in ms
  worker?: boolean | true | false
  timeoutCounter?: number
}

export type FunctionConfig = {
  memCacheTimeout?: number // in ms
  idleTimeout?: number // in ms
  maxWorkers?: number

  register: (opts: {
    server: BasedServer
    name: string
  }) => Promise<false | BasedObservableFunctionSpec | BasedFunctionSpec>

  unregister: (opts: {
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
  checksum?: number
  closeFunction?: () => void
  beingDestroyed?: NodeJS.Timeout
  onNextData?: Set<() => void>
}
