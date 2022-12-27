import { Context, HttpSession } from '../context'
import { ObservableUpdateFunction } from '../observable'
import { BasedServer } from '../server'

export type CustomHttpResponse = (
  result: any,
  payload: any,
  client: Context<HttpSession>
) => Promise<boolean>

export type BasedFunctionRoute = {
  name: string
  observable?: boolean
  headers?: string[]
  path?: string
  stream?: boolean
  maxPayloadSize?: number
  rateLimitTokens?: number
  public?: boolean
}

export type BasedObservableFunction = (
  payload: any,
  update: ObservableUpdateFunction
) => Promise<() => void>

export type BasedObservableFunctionSpec = BasedFunctionRoute & {
  name: string
  checksum: number
  observable: true
  function: BasedObservableFunction
  customHttpResponse?: CustomHttpResponse
  memCacheTimeout?: number // in ms
  idleTimeout?: number // in ms
  timeoutCounter?: number
}

export type BasedFunction = (payload: any, client: Context) => Promise<any>

export type BasedFunctionSpec = BasedFunctionRoute & {
  name: string
  observable?: false
  customHttpResponse?: CustomHttpResponse
  checksum: number
  function: BasedFunction
  maxExecTime?: number // in ms - very nice too have
  idleTimeout?: number // in ms
  timeoutCounter?: number // in ms
}

export type FunctionConfig = {
  memCacheTimeout?: number // in ms
  idleTimeout?: number // in ms
  maxWorkers?: number
  importWrapperPath?: string
  route: (opts: { server: BasedServer; name?: string; path?: string }) =>
    | false
    | (BasedFunctionRoute & {
        maxPayloadSize: number
        rateLimitTokens: number
      })

  install: (opts: {
    server: BasedServer
    name: string
    function?: BasedFunctionSpec | BasedObservableFunctionSpec
  }) => Promise<false | BasedObservableFunctionSpec | BasedFunctionSpec>

  uninstall: (opts: {
    server: BasedServer
    name: string
    function: BasedObservableFunctionSpec | BasedFunctionSpec
  }) => Promise<boolean>
}

export enum FunctionType {
  authorize,
  observe,
  function,
  streamFunction,
}

export function isObservableFunctionSpec(
  fn: BasedObservableFunctionSpec | BasedFunctionSpec
): fn is BasedObservableFunctionSpec {
  return (fn as BasedObservableFunctionSpec).observable
}
