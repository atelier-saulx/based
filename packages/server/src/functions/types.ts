import {
  BasedQueryFunction,
  BasedFunction,
  HttpResponse,
  BasedStreamFunction,
} from '@based/functions'
import { BasedServer } from '../server'

type Route = {
  name: string
  path?: string
  maxPayloadSize?: number
  rateLimitTokens?: number
  public?: boolean
  headers?: string[]
  internalOnly?: boolean
}

export type BasedFunctionRoute = Route

export type BasedQueryFunctionRoute = Route & {
  query: true
}

export type BasedStreamFunctionRoute = Route & {
  stream: true
}

export type BasedQueryFunctionSpec = {
  checksum: number
  function: BasedQueryFunction
  memCacheTimeout?: number // in ms
  idleTimeout?: number // in ms
  timeoutCounter?: number
  httpResponse?: HttpResponse
} & BasedQueryFunctionRoute

export type BasedStreamFunctionSpec = {
  // for streams no custom http response is possible scince they get multiplexed
  checksum: number
  function: BasedStreamFunction
  maxExecTime?: number // in ms - very nice too have
  idleTimeout?: number // in ms
  timeoutCounter?: number // in ms
} & BasedStreamFunctionRoute

export type BasedFunctionSpec = {
  checksum: number
  function: BasedFunction
  httpResponse?: HttpResponse
  maxExecTime?: number // in ms - very nice too have
  idleTimeout?: number // in ms
  timeoutCounter?: number // in ms
} & BasedFunctionRoute

export type BasedRoute =
  | BasedFunctionRoute
  | BasedQueryFunctionRoute
  | BasedStreamFunctionRoute

export type BasedSpec<R extends BasedRoute = BasedRoute> =
  R extends BasedQueryFunctionRoute
    ? BasedQueryFunctionSpec
    : R extends BasedStreamFunctionRoute
    ? BasedStreamFunctionSpec
    : BasedFunctionSpec

export type FunctionConfig = {
  memCacheTimeout?: number // in ms
  idleTimeout?: number // in ms
  maxWorkers?: number
  importWrapperPath?: string
  maxPayLoadSizeDefaults?: {
    stream: number
    query: number
    function: number
  }
  route: (opts: { server: BasedServer; name?: string; path?: string }) =>
    | null
    | (BasedFunctionRoute & {
        maxPayloadSize: number
        rateLimitTokens: number
      })
  install: (opts: {
    server: BasedServer
    name: string
    function?: BasedFunctionSpec | BasedQueryFunctionSpec
  }) => Promise<
    null | BasedQueryFunctionSpec | BasedStreamFunctionSpec | BasedFunctionSpec
  >
  uninstall: (opts: {
    server: BasedServer
    name: string
    function:
      | BasedQueryFunctionSpec
      | BasedStreamFunctionSpec
      | BasedFunctionSpec
  }) => Promise<boolean>
}

// specs

export function isQueryFunctionSpec(
  fn: BasedQueryFunctionSpec | BasedStreamFunctionSpec | BasedFunctionSpec
): fn is BasedQueryFunctionSpec {
  return (fn as BasedQueryFunctionSpec).query === true
}

export function isStreamFunctionSpec(
  fn: BasedQueryFunctionSpec | BasedFunctionSpec | BasedStreamFunctionSpec
): fn is BasedQueryFunctionSpec {
  return (fn as BasedStreamFunctionSpec).stream === true
}

export function isFunctionSpec(
  fn: BasedQueryFunctionSpec | BasedFunctionSpec | BasedStreamFunctionSpec
): fn is BasedSpec {
  return !('stream' in fn) && !('query' in fn)
}

export function isSpec(fn: any): fn is BasedSpec {
  return (
    fn &&
    typeof fn === 'object' &&
    (isFunctionSpec(fn) || isStreamFunctionSpec(fn) || isQueryFunctionSpec(fn))
  )
}

// routes

export function isQueryFunctionRoute(
  fn: BasedFunctionRoute | BasedQueryFunctionRoute | BasedStreamFunctionRoute
): fn is BasedQueryFunctionRoute {
  return (fn as BasedQueryFunctionRoute).query === true
}

export function isStreamFunctionRoute(
  fn: BasedFunctionRoute | BasedQueryFunctionRoute | BasedStreamFunctionRoute
): fn is BasedStreamFunctionRoute {
  return (fn as BasedStreamFunctionRoute).stream === true
}

export function isFunctionRoute(
  fn: BasedFunctionRoute | BasedQueryFunctionRoute | BasedStreamFunctionRoute
): fn is BasedFunctionRoute {
  return !('stream' in fn) && !('query' in fn)
}

export function isRoute(route: any): route is BasedRoute {
  if (route && typeof route === 'object' && 'name' in route) {
    return true
  }
  return false
}
