import { Context, HttpSession } from './context'
import { BasedFunctionClient } from './client'
import { Duplex } from 'stream'

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

export type CustomHttpResponse = (
  result: any,
  payload: any,
  ctx: Context<HttpSession>,
  sendHttpResponse: (ctx: Context<HttpSession>, result: any) => void
) => Promise<boolean>

export type BasedFunction<P = any, K = any> = (
  based: BasedFunctionClient,
  payload: P,
  ctx: Context
) => Promise<K>

export type StreamPayload<P = any> = {
  payload?: P
  mimeType: string
  size: number
  stream: Duplex & {
    size: number
    receivedBytes: number
  }
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
      update: ObservableUpdateFunction<K>
    ) => Promise<() => void>)
  | ((
      based: BasedFunctionClient,
      payload: P,
      update: ObservableUpdateFunction<K>
    ) => () => void)
