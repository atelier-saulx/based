import {
  BasedQueryFunction,
  BasedFunction,
  CustomHttpResponse,
  BasedStreamFunction,
} from '@based/functions'
import { BasedServer } from '../server'

export type BasedRoute = {
  name: string
  query?: boolean
  headers?: string[]
  path?: string
  maxPayloadSize?: number
  rateLimitTokens?: number
  public?: boolean
}

export type BasedStreamFunctionRoute = BasedRoute & {
  stream?: true
}

export type BasedFunctionRoute =
  | (BasedRoute & { stream?: false })
  | BasedStreamFunctionRoute

export type BasedObservableFunctionSpec = BasedFunctionRoute & {
  name: string
  checksum: number
  query: true
  function: BasedQueryFunction
  customHttpResponse?: CustomHttpResponse
  memCacheTimeout?: number // in ms
  idleTimeout?: number // in ms
  timeoutCounter?: number
}

export type BasedFunctionSpec =
  | (BasedStreamFunctionRoute & {
      name: string
      observable?: false
      customHttpResponse?: CustomHttpResponse
      checksum: number
      function: BasedStreamFunction
      maxExecTime?: number // in ms - very nice too have
      idleTimeout?: number // in ms
      timeoutCounter?: number // in ms
    })
  | ((BasedRoute & { stream?: false }) & {
      name: string
      observable?: false
      customHttpResponse?: CustomHttpResponse
      checksum: number
      function: BasedFunction
      maxExecTime?: number // in ms - very nice too have
      idleTimeout?: number // in ms
      timeoutCounter?: number // in ms
    })

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
  return (fn as BasedObservableFunctionSpec).query
}
