import { GenericObject } from './generic.js'

export type FunctionResponseListeners = Map<
  number,
  [(val?: any) => void, (err: Error) => void, string?]
>

export type FunctionQueueItem = [number, string, GenericObject]
export type FunctionQueue = FunctionQueueItem[]

export type CallOptions = {
  retryStrategy: (
    err: Error,
    time: number,
    retries: number
  ) => 0 | null | undefined | false | number
}

export type QueryOptions = { persistent: boolean }
