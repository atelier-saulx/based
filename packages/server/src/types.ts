import type { BasedServer } from './server'
import type uws from '@based/uws'

export type ServerOptions = {
  port?: number
  key?: string
  cert?: string
  functions?: FunctionConfig
  authorizeConnection?: AuthorizeConnection
}

export type AuthorizeConnection = (req: uws.HttpRequest) => Promise<boolean>

export type ObservableUpdateFunction = (
  data: any,
  checksum: number,
  diff?: any,
  fromChecksum?: number
) => {}

export type BasedObservableFunctionSpec = {
  name: string
  checksum: number
  observable: true
  function: (payload: any, update: ObservableUpdateFunction) => () => void
  memCacheTimeout?: number // in seconds
  idleTimeout?: number // in 3 seconds
  worker?: string | true | false
  timeoutCounter?: number // bit harder have to add
}

export type BasedFunctionSpec = {
  name: string
  checksum: number
  function: (payload: any, ws: uws.WebSocket) => Promise<any>
  idleTimeout?: number // in 3 seconds
  worker?: boolean | true | false
  timeoutCounter?: number
}

// first byte has to encode the length
// type + length ? ;/
// return type is a lot better 256 options (max functions) maybe 2 bytes

export type FunctionConfig = {
  memCacheTimeout?: number // in seconds
  idleTimeout?: number // in 3 seconds
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
