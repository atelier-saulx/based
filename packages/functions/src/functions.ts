import { Context, HttpSession } from './context'
import { BasedFunctionClient } from './client'
import { Stream } from 'stream'

export type ObservableUpdateFunction = {
  (
    data: any,
    checksum?: number,
    diff?: any,
    fromChecksum?: number,
    isDeflate?: boolean,
    rawData?: any,
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
  client: Context<HttpSession>
) => Promise<boolean>

export type BasedFunction<P = any, K = any> = (
  based: BasedFunctionClient,
  payload: P,
  ctx: Context
) => Promise<K>

export type BasedStreamFunction<P = any, K = any> = BasedFunction<
  {
    payload?: P
    mimeType: string
    size: number
    stream: Stream & {
      size: number
      receivedBytes: number
    }
    fileName?: string
    extension?: string
  },
  K
>

export type BasedQueryFunction<P = any> =
  | ((
      based: BasedFunctionClient,
      payload: P,
      update: ObservableUpdateFunction
    ) => Promise<() => void>)
  | ((
      based: BasedFunctionClient,
      payload: P,
      update: ObservableUpdateFunction
    ) => () => void)
