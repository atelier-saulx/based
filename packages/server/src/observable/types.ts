import { BasedError, BasedErrorCode, BasedErrorData } from '../error'

export type ObservableUpdateFunction = {
  (
    data: any,
    checksum?: number,
    diff?: any,
    fromChecksum?: number,
    isDeflate?: boolean,
    rawData?: any,
    err?: Error | BasedErrorData<BasedErrorCode.ObservableFunctionError>
  ): void
  __internalObs__?: true
}

export type ObserveErrorListener = (
  err:
    | BasedError<BasedErrorCode.ObservableFunctionError>
    | BasedErrorData<BasedErrorCode.ObservableFunctionError>
    | BasedError<BasedErrorCode.FunctionIsNotObservable>
    | BasedErrorData<BasedErrorCode.FunctionIsNotObservable>
    | BasedError<BasedErrorCode.FunctionNotFound>
    | BasedErrorData<BasedErrorCode.FunctionNotFound>
) => void

export type ActiveObservable = {
  startId: number
  name: string
  id: number
  reusedCache: boolean
  functionObserveClients: Set<ObservableUpdateFunction>
  clients: Set<number>
  onNextData?: Set<
    (err?: BasedError<BasedErrorCode.ObservableFunctionError>) => void
  >
  isDestroyed: boolean
  payload: any
  diffCache?: Uint8Array
  cache?: Uint8Array
  rawData?: any
  previousChecksum?: number
  isDeflate?: boolean
  checksum?: number
  closeFunction?: () => void
  beingDestroyed?: NodeJS.Timeout
  error?: BasedError<BasedErrorCode.ObservableFunctionError> | null
}
