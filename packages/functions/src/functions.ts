import { Context } from './context'
import { BasedFunctionClient } from './client'

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

export type ObserveErrorListener = (err: any) => void

export type BasedFunction = (
  based: BasedFunctionClient,
  payload: any,
  ctx: Context
) => Promise<any>

export type BasedQueryFunction =
  | ((
      based: BasedFunctionClient,
      payload: any,
      update: ObservableUpdateFunction
    ) => Promise<() => void>)
  | ((
      based: BasedFunctionClient,
      payload: any,
      update: ObservableUpdateFunction
    ) => () => void)
