import {
  BasedQueryFunction,
  BasedFunction,
  HttpResponse,
  BasedStreamFunction,
} from '@based/functions'
import { BasedServer } from '../server'

type Route = {
  /** Function name */
  name: string
  /** In addition to the name, a function can have a custom path for HTTP requests.
   * For example: `path: 'my/custom/path'` will result in the function being
   * available with a request to `edgeurl.based.io/my/custom/path`
   */
  path?: string
  /** In bytes. `-1` indicates no size limit */
  maxPayloadSize?: number
  /** Cost in tokens for this function call.  */
  rateLimitTokens?: number
  /** A function marked as `public` will skip the call to authorize. */
  public?: boolean
  /** Array of headers that this function expects to receive. */
  headers?: string[]
  /** A function marked as `internalOnly` will only be accessible from other server side functions,
   * and not through the public internet.
   */
  internalOnly?: boolean
}

export type BasedFunctionRoute = Route

export type BasedQueryFunctionRoute = Route & {
  query: true
}

export type BasedStreamFunctionRoute = Route & {
  stream: true
}

export type BasedInstallableFunctionSpec = {
  /** Hash of the BasedFunction */
  checksum: number
  /** in ms */
  idleTimeout?: number
  /** in ms */
  timeoutCounter?: number
}

export type BasedQueryFunctionSpec = {
  function: BasedQueryFunction
  /** How long should this subscription remain in memory after all subscribers are gone, in ms */
  memCacheTimeout?: number
  /** When in an HTTP context, this function is called to wrap the return value of the BasedFunction, and inject headers and a status code */
  httpResponse?: HttpResponse
} & BasedQueryFunctionRoute &
  BasedInstallableFunctionSpec

export type BasedStreamFunctionSpec = {
  // for streams no custom http response is possible scince they get multiplexed
  function: BasedStreamFunction
  /** in ms */
  maxExecTime?: number
} & BasedStreamFunctionRoute &
  BasedInstallableFunctionSpec

export type BasedFunctionSpec = {
  function: BasedFunction
  /** When in an HTTP context, this function is called to wrap the return value of the BasedFunction, and inject headers and a status code */
  httpResponse?: HttpResponse
  /** in ms */
  maxExecTime?: number
} & BasedFunctionRoute &
  BasedInstallableFunctionSpec

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
  /** in ms */
  memCacheTimeout?: number
  /** in ms */
  idleTimeout?: number
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
