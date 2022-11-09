import { GenericObject } from './generic'

export type FunctionResponseListeners = Map<
  number,
  [(val?: any) => void, (err: Error) => void, string?]
>

export type FunctionQueueItem = [number, string, GenericObject]
export type FunctionQueue = FunctionQueueItem[]
