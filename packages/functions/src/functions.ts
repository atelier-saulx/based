import type { Required } from 'utility-types'
import { Context, HttpSession } from './context.js'
import { BasedFunctionClient } from './client.js'
import { BasedDataStream } from './stream.js'
import { Authorize } from './auth.js'

export type ObservableUpdateFunction<K = any> = (
  data: K,
  checksum?: number,
  err?: any,
  cache?: Uint8Array,
  diff?: any,
  fromChecksum?: number,
  isDeflate?: boolean
) => void

export type ObserveErrorListener = (err: any) => void

export type HttpHeaders = {
  [header: string]: number | string | (string | number)[]
}

export type SendHttpResponse = (
  responseData: any,
  headers?: HttpHeaders,
  status?: string | number
) => void

export type HttpResponse<P = any, K = any> = (
  based: BasedFunctionClient,
  payload: P,
  responseData: K,
  send: SendHttpResponse,
  ctx: Context<HttpSession>
) => Promise<void>

export type BasedFunction<P = any, K = any> = (
  based: BasedFunctionClient,
  payload: P,
  ctx: Context
) => Promise<K>

export type BasedAppFunction = (
  based: BasedFunctionClient,
  assets: {
    css: {
      text: Promise<string>
      url: string
    }
    js: {
      text: Promise<string>
      url: string
    }
    favicon: {
      url: string
      content: string
      path: string
    }
  },
  ctx: Context
) => Promise<string>

export type StreamPayload<P = any> = {
  payload?: P
  mimeType: string
  size: number
  stream: BasedDataStream
  fileName?: string
  extension?: string
  fn?: string
  seqId?: number
}

export type BasedStreamFunction<P = any, K = any> = BasedFunction<
  StreamPayload<P>,
  K
>

export type BasedQueryFunction<P = any, K = any> =
  | ((
      based: BasedFunctionClient,
      payload: P,
      update: ObservableUpdateFunction<K>,
      error: ObserveErrorListener
    ) => Promise<() => void>)
  | ((
      based: BasedFunctionClient,
      payload: P,
      update: ObservableUpdateFunction<K>,
      error: ObserveErrorListener
    ) => () => void)

export type BasedChannelFunction<P = any, K = any> = (
  based: BasedFunctionClient,
  payload: P,
  id: number,
  update: ChannelMessageFunction<K>,
  error: (err?: any) => void
) => () => void

export type BasedChannelPublishFunction<P = any, M = any> = (
  based: BasedFunctionClient,
  payload: P,
  message: M,
  id: number,
  ctx: Context
) => void

export type ChannelMessageFunction<M = any> = (message: M) => void

export type ChannelMessageFunctionInternal<K = any> = (
  message: K,
  err?: any
) => void

export type BasedJobFunction =
  | ((based: BasedFunctionClient) => Promise<() => void>)
  | ((based: BasedFunctionClient) => () => void)

export type UninstallFunction = () => Promise<void>

// ------------ Config -------------------
type FunctionConfigShared = {
  /** Function name */
  name?: string
  /** In addition to the name, a function can have a custom path for HTTP requests.
   * For example: `path: 'my/custom/path'` will result in the function being
   * available with a request to `env.based.io/my/custom/path`
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
  /** Can hold extra information about a spec */
  data?: any
  /** Unistall after idle, in ms -1 indicates endless */
  uninstallAfterIdleTime?: number
  /** Hook that fires on uninstall of the function e.g. to clean up database connections */
  uninstall?: UninstallFunction
  /** Specific authorize for this function */
  authorize?: Authorize
  /** Relay allows functions to relay traffic to another `@based/server` 
    `Currently not supported for `stream` 
  
    ```js
    new BasedServer({ 
    clients: { events: BasedClient },
    functions: { 
      specs: 
        somethingToRelay: { 
          relay: { client: 'events', target: 'hello' }, 
          type: 'function' 
        })
      }
    }
    })
    ```
  */
  relay?: {
    client: string
    target?: string
  }
  /** Function version */
  version?: number
  /** Used inernaly to check if a function is ready to uninstall */
  timeoutCounter?: number
}

type FunctionConfigSharedComplete = Required<
  FunctionConfigShared,
  'maxPayloadSize' | 'rateLimitTokens' | 'version' | 'name'
>

export type BasedFunctionTypes =
  | 'channel'
  | 'query'
  | 'function'
  | 'stream'
  | 'app'
  | 'job'

type BasedChannelFunctionConfig = {
  /** Function type `channel, function, query, stream, authorize` */
  type: 'channel'
  /** Channel subscriber 
    
   ```js
   const subscribe = (based, payload, id, update) => {
      let cnt = 0
      const interval = setInterval(() => {
        update(++cnt)
      })
      return () => clearInterval(cnt)
   }
   ```
  */
  subscriber?: BasedChannelFunction
  /** Channel publisher 
    
   ```js
   const publisher = (based, payload, msg, id) => {
      publishToChannel(id, msg)
   }
   ```
  */
  publisher?: BasedChannelPublishFunction
  /** Makes only the publisher public */
  publicPublisher?: boolean
  /** How long should the channel subscriber remain active after all subscribers are gone, in ms */
  closeAfterIdleTime?: number
  /** Only for Publisher */
  httpResponse?: HttpResponse
  /** Throttle amount of outgoing messages, in milliseconds */
  throttle?: number
}

type BasedCallFunctionConfig = {
  /** Function type `channel, function, query, stream` */
  type: 'function'
  fn?: BasedFunction
  httpResponse?: HttpResponse
}

type BasedQueryFunctionConfig = {
  /** Function type `channel, function, query, stream` */
  type: 'query'
  fn?: BasedQueryFunction
  httpResponse?: HttpResponse
  /** How long should the query function remain active after all subscribers are gone, in ms */
  closeAfterIdleTime?: number
  /** Throttle amount of outgoing messages, in milliseconds */
  throttle?: number
}

type BasedStreamFunctionConfig = {
  /** Function type `channel, function, query, stream` */
  type: 'stream'
  fn: BasedStreamFunction
}

type BasedAppFunctionConfig = {
  type: 'app'
  main: string
  path?: string
  favicon?: string
}

type BasedJobFunctionConfig = {
  type: 'job'
  fn?: BasedFunction
}

export type BasedFunctionConfig<
  T extends BasedFunctionTypes = BasedFunctionTypes
> = T extends 'channel'
  ? BasedChannelFunctionConfig & FunctionConfigShared
  : T extends 'function'
  ? BasedCallFunctionConfig & FunctionConfigShared
  : T extends 'query'
  ? BasedQueryFunctionConfig & FunctionConfigShared
  : T extends 'stream'
  ? BasedStreamFunctionConfig & FunctionConfigShared
  : T extends 'job'
  ? BasedJobFunctionConfig & FunctionConfigShared
  : T extends 'app'
  ? BasedAppFunctionConfig & FunctionConfigShared
  :
      | (BasedChannelFunctionConfig & FunctionConfigShared)
      | (BasedCallFunctionConfig & FunctionConfigShared)
      | (BasedQueryFunctionConfig & FunctionConfigShared)
      | (BasedStreamFunctionConfig & FunctionConfigShared)
      | (BasedJobFunctionConfig & FunctionConfigShared)
      | (BasedAppFunctionConfig & FunctionConfigShared)

export type BasedFunctionConfigComplete<
  T extends BasedFunctionTypes = BasedFunctionTypes
> = T extends 'channel'
  ? BasedChannelFunctionConfig & FunctionConfigSharedComplete
  : T extends 'function'
  ? BasedCallFunctionConfig & FunctionConfigSharedComplete
  : T extends 'query'
  ? BasedQueryFunctionConfig & FunctionConfigSharedComplete
  : T extends 'stream'
  ? BasedStreamFunctionConfig & FunctionConfigSharedComplete
  : T extends 'job'
  ? BasedJobFunctionConfig & FunctionConfigSharedComplete
  : T extends 'app'
  ? BasedAppFunctionConfig & FunctionConfigSharedComplete
  :
      | (BasedChannelFunctionConfig & FunctionConfigSharedComplete)
      | (BasedCallFunctionConfig & FunctionConfigSharedComplete)
      | (BasedQueryFunctionConfig & FunctionConfigSharedComplete)
      | (BasedStreamFunctionConfig & FunctionConfigSharedComplete)
      | (BasedJobFunctionConfig & FunctionConfigSharedComplete)
      | (BasedAppFunctionConfig & FunctionConfigSharedComplete)

export type BasedAuthorizeFunctionConfig = {
  /** Function type `authorize` */
  type: 'authorize'
  fn?: Authorize
}

export type BasedRoute<
  T extends BasedFunctionTypes = BasedFunctionTypes,
  R extends keyof BasedFunctionConfig = 'type' | 'name'
> = Required<Partial<BasedFunctionConfig<T>>, R>

export type BasedRouteComplete<
  T extends BasedFunctionTypes = BasedFunctionTypes
> = Required<
  Partial<BasedFunctionConfig<T>>,
  'type' | 'name' | 'maxPayloadSize' | 'rateLimitTokens'
>

export function isBasedRoute<T extends BasedFunctionTypes>(
  type: T,
  route: any
): route is BasedRoute<T> {
  return (
    route &&
    typeof route === 'object' &&
    route.type === type &&
    typeof route.name === 'string'
  )
}

export function isAnyBasedRoute(route: any): route is BasedRoute {
  return (
    route &&
    typeof route === 'object' &&
    (route.type === 'channel' ||
      route.type === 'query' ||
      route.type === 'function' ||
      route.type === 'stream') &&
    typeof route.name === 'string'
  )
}

export function isBasedFunctionConfig<T extends BasedFunctionTypes>(
  type: T,
  config: any
): config is BasedFunctionConfig<T> {
  return isBasedRoute(type, config)
}

export function isAnyBasedFunctionConfig(
  config: any
): config is BasedFunctionConfig {
  return isAnyBasedRoute(config)
}

export type BasedRoutes = {
  [name: string]: BasedRoute<BasedFunctionTypes, 'type'>
}

export type BasedFunctionConfigs = {
  [name: string]: BasedFunctionConfig<BasedFunctionTypes>
}
