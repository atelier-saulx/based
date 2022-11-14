import { ClientContext, HttpMethod } from '../types'
import { BasedError, BasedErrorCode, ErrorPayload } from '../error'

export enum IncomingType {
  WsFunction = 0,
  CreateObs = 1,
  CloseObs = 2,
  HttpFunction = 3,
  AddFunction = 4,
  RemoveFunction = 5,
  InstallFunctionError = 6,
  UpdateObservable = 7,
  Authorize = 8,
}

export type Incoming = {
  [IncomingType.WsFunction]: {
    type: IncomingType.WsFunction
    path: string
    name: string
    id: number
    reqId: number
    context: ClientContext
    isDeflate: boolean
    payload?: Uint8Array
  }

  [IncomingType.CreateObs]: {
    type: IncomingType.CreateObs
    path: string
    name: string
    id: number
    payload: any
  }

  [IncomingType.CloseObs]: {
    type: IncomingType.CloseObs
    id: number
  }

  [IncomingType.HttpFunction]: {
    name: string
    type: IncomingType.HttpFunction
    method: HttpMethod
    path: string
    id: number
    context: ClientContext
    payload?: Uint8Array
  }

  [IncomingType.AddFunction]: {
    type: IncomingType.AddFunction
    path: string
    name: string
  }

  [IncomingType.RemoveFunction]: {
    name: string
    type: IncomingType.RemoveFunction
  }

  [IncomingType.InstallFunctionError]: {
    type: IncomingType.InstallFunctionError
    name: string
  }

  [IncomingType.UpdateObservable]: {
    type: IncomingType.UpdateObservable
    name: string
    id: number
    checksum?: number
    data?: Uint8Array
    err?: BasedError<BasedErrorCode.ObservableFunctionError>
    diff?: Uint8Array
    previousChecksum?: number
    isDeflate?: boolean
  }

  [IncomingType.Authorize]: {
    type: IncomingType.Authorize
    context: ClientContext
    name: string
    id: number
    payload?: any
  }
}

export type IncomingMessage = Incoming[keyof Incoming]

export enum OutgoingType {
  InstallFn = 0,
  Subscribe = 1,
  Unsubscribe = 2,
  Log = 3,
  Error = 4,
  Listener = 5,
  ObservableUpdate = 6,
}

export type Outgoing = {
  [OutgoingType.ObservableUpdate]:
    | {
        type: OutgoingType.ObservableUpdate
        id: number
        payload: {
          diff?: Uint8Array
          data: Uint8Array
          checksum: number
          isDeflate: boolean
          reusedCache: boolean
        }
      }
    | {
        type: OutgoingType.ObservableUpdate
        id: number
        err: Error
      }
  [OutgoingType.InstallFn]: {
    type: OutgoingType.InstallFn
    name: string
  }
  [OutgoingType.Subscribe]: {
    type: OutgoingType.Subscribe
    name: string
    id: number
    payload: any
    context: ClientContext
  }
  [OutgoingType.Unsubscribe]: {
    type: OutgoingType.Unsubscribe
    id: number
    context: ClientContext
  }
  [OutgoingType.Log]: {
    type: OutgoingType.Log
    context?: ClientContext
    log: any // TODO: make it serializable...
  }
  [OutgoingType.Error]: {
    type: OutgoingType.Error
    context?: ClientContext
    code: BasedErrorCode
    payload: ErrorPayload[BasedErrorCode]
  }
  [OutgoingType.Listener]:
    | {
        type: OutgoingType.Listener
        id: number
        err?: Error
        code: BasedErrorCode
      }
    | {
        type: OutgoingType.Listener
        id: number
        payload: any
      }
}

export type OutgoingMessage = Outgoing[keyof Outgoing]
