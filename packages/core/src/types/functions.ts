import { GenericObject } from './generic'

export type FunctionResponseListeners = {
  [reqId: string]: [(val?: any) => void, (err: Error) => void]
}

// string can also be hashed then we can store it in 32bits
export type FunctionQueue = [number, string, GenericObject][]
