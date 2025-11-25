import { GenericObject } from './generic.js'

export type FunctionResponseListeners = Map<
  number,
  [(val?: any) => void, (err: Error) => void, string?]
>

export type FunctionQueueItem = [number, string, GenericObject]
export type FunctionQueue = FunctionQueueItem[]

export type RetryResult = {
  payload?: any
  time?: number
}

export type RetryResultAll = RetryResult | null | undefined | false | number

export type CallOptions = {
  retryStrategy: (
    err: Error,
    time: number,
    retries: number,
  ) => Promise<RetryResultAll> | RetryResultAll
}

export type QueryOptions = { persistent: boolean }
