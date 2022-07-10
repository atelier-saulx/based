import { BasedServer } from '..'
import { BasedObservableFunction } from './functions/observable'
import { BasedFunction } from './functions/function'

export type ServerOptions = {
  port: number
  key?: string
  cert?: string
  functions?: FunctionConfig
}

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
  memCache?: number // in seconds
  idleTimeout?: number // in seconss
  worker?: string | true | false
}

export type BasedFunctionSpec = {
  name: string
  checksum: number
  function: (payload: any) => Promise<any>
  idleTimeout?: number // in seconss
  worker?: boolean | true | false
}

export function isObservableFunctionSpec(
  fn: BasedObservableFunctionSpec | BasedFunctionSpec
): fn is BasedObservableFunctionSpec {
  return (fn as BasedObservableFunctionSpec).observable
}

export type FunctionConfig = {
  memCache?: number
  idleTimeout?: number
  maxWorkers?: number

  register: (opts: {
    server: BasedServer
    name: string
    observable: boolean
  }) => Promise<boolean>

  unRegister: (opts: {
    server: BasedServer
    name: string
    function: BasedObservableFunction | BasedFunction
  }) => Promise<boolean>

  log?: (opts: {
    server: BasedServer
    type: 'error' | 'warn' | 'info' | 'log'
    name: string
    message: string
    callstack: string[]
  }) => boolean
}
