import { GenericObject } from './generic'

export type FunctionResponseListeners = {
  [reqId: string]: [(val?: any) => void, (err: Error) => void]
}

export type FunctionQueue = [number, string, GenericObject][]
