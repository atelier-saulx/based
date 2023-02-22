import {
  BasedQueryFunction,
  BasedFunction,
  BasedChannelFunction,
  HttpResponse,
  UninstallFunction,
  BasedStreamFunction,
  BasedChannelPublishFunction,
} from '@based/functions'
import { BasedServer } from '../server'

export type FunctionConfig = {
  /** Default number to close channels & queries when no subscribers are active in ms */
  closeAfterIdleTime?: {
    query: number
    channel: number
  }
  /** Default time to uinstall function after it has been idle in ms */
  uninstallAfterIdleTime?: number
  /** Default max payload sizes in bytes */
  maxPayLoadSizeDefaults?: {
    stream: number
    query: number
    function: number
    channel: number
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
    function?: BasedSpec
  }) => Promise<null | BasedSpec>
  uninstall: (opts: {
    server: BasedServer
    name: string
    function: BasedSpec
  }) => Promise<boolean>
}

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

export type BasedChannelFunctionRoute = Route & {
  channel: true
}

export type BasedInstallableFunctionSpec = {
  /** Version hash of the BasedFunction */
  checksum: number
  /** Uinstall function after it has been idle, in ms */
  uninstallAfterIdleTime?: number
  /** In ms */
  timeoutCounter?: number
  /** Hook that fires on uninstall of the function e.g. to clean up database connections */
  uninstall?: UninstallFunction
}

export type BasedQueryFunctionSpec = {
  function: BasedQueryFunction
  /** How long should the query function remain active after all subscribers are gone, in ms */
  closeAfterIdleTime?: number
  /** When in an HTTP context, this function is called to wrap the return value of the BasedFunction, and inject headers and a status code */
  httpResponse?: HttpResponse
} & BasedQueryFunctionRoute &
  BasedInstallableFunctionSpec

export type BasedStreamFunctionSpec = {
  // For streams no custom http response is possible scince they get multiplexed
  function: BasedStreamFunction
  /** Maximum allowed execution time, in ms */
  maxExecTime?: number
} & BasedStreamFunctionRoute &
  BasedInstallableFunctionSpec

export type BasedFunctionSpec = {
  function: BasedFunction
  /** When in an HTTP context, this function is called to wrap the return value of the BasedFunction, and inject headers and a status code */
  httpResponse?: HttpResponse
  /** Maximum allowed execution time, in ms */
  maxExecTime?: number
} & BasedFunctionRoute &
  BasedInstallableFunctionSpec

export type BasedChannelFunctionSpec = {
  function: BasedChannelFunction
  /** Publish allows publishing to channels */
  publish: BasedChannelPublishFunction
  /** How long should the channel remain active after all subscribers ae gone, in ms */
  closeAfterIdleTime?: number
  /** When in an HTTP context, this function is called to wrap the return value of the publish endpoint, and inject headers and a status code */
  httpResponse?: HttpResponse
} & BasedChannelFunctionRoute &
  BasedInstallableFunctionSpec

export type BasedRoute =
  | BasedFunctionRoute
  | BasedQueryFunctionRoute
  | BasedStreamFunctionRoute
  | BasedChannelFunctionRoute

export type BasedSpec<R extends BasedRoute = BasedRoute> =
  R extends BasedChannelFunctionRoute
    ? BasedChannelFunctionSpec
    : R extends BasedQueryFunctionRoute
    ? BasedQueryFunctionSpec
    : R extends BasedStreamFunctionRoute
    ? BasedStreamFunctionSpec
    : BasedFunctionSpec

// ---------- specs -------------
export function isChannelFunctionSpec(
  fn: BasedSpec
): fn is BasedChannelFunctionSpec {
  return (fn as BasedChannelFunctionSpec).channel === true
}

export function isQueryFunctionSpec(
  fn: BasedSpec
): fn is BasedQueryFunctionSpec {
  return (fn as BasedQueryFunctionSpec).query === true
}

export function isStreamFunctionSpec(
  fn: BasedSpec
): fn is BasedQueryFunctionSpec {
  return (fn as BasedStreamFunctionSpec).stream === true
}

export function isFunctionSpec(fn: BasedSpec): fn is BasedSpec {
  return !('stream' in fn) && !('query' in fn)
}

export function isSpec(fn: any): fn is BasedSpec {
  return (
    fn &&
    typeof fn === 'object' &&
    (isFunctionSpec(fn) ||
      isStreamFunctionSpec(fn) ||
      isQueryFunctionSpec(fn) ||
      isChannelFunctionSpec(fn))
  )
}

// ---------- routes -------------
export function isQueryFunctionRoute(
  fn: BasedRoute
): fn is BasedQueryFunctionRoute {
  return (fn as BasedQueryFunctionRoute).query === true
}

export function isStreamFunctionRoute(
  fn: BasedRoute
): fn is BasedStreamFunctionRoute {
  return (fn as BasedStreamFunctionRoute).stream === true
}

export function isChannelFunctionRoute(
  fn: BasedRoute
): fn is BasedChannelFunctionRoute {
  return (fn as BasedChannelFunctionRoute).channel === true
}

export function isFunctionRoute(fn: BasedRoute): fn is BasedFunctionRoute {
  return !('stream' in fn) && !('query' in fn) && !('channel' in fn)
}

export function isRoute(route: any): route is BasedRoute {
  if (route && typeof route === 'object' && 'name' in route) {
    return true
  }
  return false
}
