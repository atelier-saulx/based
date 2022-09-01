import { GenericObject } from './generic'

export type FunctionResponseListeners = Map<
  number,
  [(val?: any) => void, (err: Error) => void]
>

export type FunctionQueue = [number, string, GenericObject][]
