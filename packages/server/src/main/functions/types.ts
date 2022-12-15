import { BasedServer } from '../server'
import { HttpClient } from '../types'
import {
  ObservableUpdateFunction,
  ClientContext,
  BasedFunctionRoute,
} from '../../types'

export type FunctionConfig = {
  memCacheTimeout?: number // in ms
  idleTimeout?: number // in ms
  maxWorkers?: number
  importWrapperPath?: string
  route: (opts: {
    server: BasedServer
    name?: string
    path?: string
  }) => false | BasedFunctionRoute

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

export type CustomHttpResponse = (
  result: any,
  payload: any,
  client: HttpClient
) => Promise<boolean>

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
  observable?: false
  customHttpResponse?: CustomHttpResponse
  checksum: number
  stickyWorker?: string
  functionPath: string
  maxExecTime?: number // in ms - very nice too have
  idleTimeout?: number // in ms
  timeoutCounter?: number // in ms
}

export enum FunctionType {
  authorize,
  observe,
  function,
  streamFunction,
}

export type ImportWrapper = (
  name: string,
  type: FunctionType,
  path: string
) => Function

export function isObservableFunctionSpec(
  fn: BasedObservableFunctionSpec | BasedFunctionSpec
): fn is BasedObservableFunctionSpec {
  return (fn as BasedObservableFunctionSpec).observable
}
