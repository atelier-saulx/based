import { BasedError, BasedErrorCode } from './error'
// Types shared types between worker / main

export type ClientContext =
  | {
      query: string
      ua: string
      ip: string
      callStack?: string[]
      id: number
      fromAuth?: boolean
      authState?: any
      method: string
      headers: {
        'content-length'?: number
        authorization?: string
        'content-type'?: string
        'content-encoding'?: string
        encoding?: string
      } & { [key: string]: string }
    }
  | {
      callStack?: string[]
      fromAuth?: boolean
      headers: {
        'content-length'?: number
        authorization?: string
        'content-type'?: string
        'content-encoding'?: string
        encoding?: string
      }
    }

export type ObservableUpdateFunction = (
  data: any,
  checksum?: number,
  diff?: any,
  fromChecksum?: number,
  isDeflate?: boolean
) => void

export type ObserveErrorListener = (
  err: BasedError<BasedErrorCode.ObservableFunctionError>
) => void

export type ObservableCache = {
  checksum: number
  reusedCache: boolean
  diffCache?: Uint8Array
  cache?: Uint8Array
  previousChecksum?: number
  isDeflate?: boolean
}

export type BasedFunctionRoute = {
  name: string
  observable?: boolean
  maxPayloadSize?: number
  headers?: string[]
  path?: string
  stream?: boolean
  rateLimitTokens?: number
}

export const isBasedFunctionRoute = (
  route: any
): route is BasedFunctionRoute => {
  if (route && typeof route === 'object' && 'name' in route) {
    return true
  }
  return false
}

export enum HttpMethod {
  Post,
  Get,
}
