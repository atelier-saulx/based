import { GenericObject } from './generic'

export type FunctionResponseListeners = {
  // can do the same - resend
  [reqId: string]: {
    resolve: (val?: any) => void
    reject: (err: Error) => void
  }
}

export type FunctionQueue = { name: string; payload: GenericObject }[]
