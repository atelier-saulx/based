import { Context, HttpSession } from './context'
import { BasedFunctionClient } from './client'
import { BasedDataStream } from './stream'
import { Authorize } from './auth'

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

export type StreamPayload<P = any> = {
  payload?: P
  mimeType: string
  size: number
  stream: BasedDataStream
  fileName?: string
  extension?: string
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

export type UninstallFunction = () => Promise<void>

type FunctionConfigShared = {
  /** Function name */
  name: string
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
  /** Unistall after idle, in ms */
  uninstallAfterIdleTime?: number
  /** Hook that fires on uninstall of the function e.g. to clean up database connections */
  uninstall?: UninstallFunction
  /** Specific authorize for this function */
  authorize?: Authorize
}

export type BasedFunctionConfig =
  | ({
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
      name: string
      /** How long should the channel subscriber remain active after all subscribers are gone, in ms */
      closeAfterIdleTime?: number
    } & FunctionConfigShared)
  | ({
      /** Function type `channel, function, query, stream, authorize` */
      type: 'function'
      function: BasedFunction
      name: string
      httpResponse?: HttpResponse
    } & FunctionConfigShared)
  | ({
      /** Function type `channel, function, query, stream, authorize` */
      type: 'query'
      function: BasedQueryFunction
      name: string
      httpResponse?: HttpResponse
      /** How long should the query function remain active after all subscribers are gone, in ms */
      closeAfterIdleTime?: number
    } &
      FunctionConfigShared)
  | ({
      /** Function type `channel, function, query, stream, authorize` */
      type: 'stream'
      function: BasedStreamFunction
      name: string
    } & FunctionConfigShared)
  | {
      /** Function type `channel, function, query, stream, authorize` */
      type: 'authorize'
      function: Authorize
      name: string
    }
