import { Context, HttpSession } from './context'
import { BasedFunctionClient } from './client'
import { BasedDataStream } from './stream'

export type ObservableUpdateFunction<K = any> = {
  (
    data: K,
    checksum?: number,
    diff?: any,
    fromChecksum?: number,
    isDeflate?: boolean,
    rawData?: K,
    // todo fix there errors TODO: make extra package 'errors' for client and server
    err?: any
  ): void
  __internalObs__?: true
}

// TODO: use error package
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
      error?: ObserveErrorListener
    ) => Promise<() => void>)
  | ((
      based: BasedFunctionClient,
      payload: P,
      update: ObservableUpdateFunction<K>,
      error?: ObserveErrorListener
    ) => () => void)

export type BasedChannelFunction<P = any, K = any> = (
  based: BasedFunctionClient,
  channelId: P,
  update: ChannelMessageFunction<K>
) => () => void

export type ChannelMessageFunction<K = any> = (message: K) => void
