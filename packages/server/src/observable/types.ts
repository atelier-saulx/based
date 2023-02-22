import { BasedErrorCode, BasedErrorData } from '../error'

export type ObservableUpdateFunction = {
  (
    data: any,
    checksum?: number,
    diff?: any,
    fromChecksum?: number,
    isDeflate?: boolean,
    rawData?: any,
    err?: Error | BasedErrorData<BasedErrorCode.FunctionError>
  ): void
  __internalObs__?: true
}

export type ObserveErrorListener = (
  err:
    | BasedErrorData<BasedErrorCode.FunctionError>
    | BasedErrorData<BasedErrorCode.FunctionIsWrongType>
    | BasedErrorData<BasedErrorCode.FunctionNotFound>
) => void

export type ActiveObservable = {
  startId: number
  name: string
  id: number
  reusedCache: boolean
  functionObserveClients: Set<ObservableUpdateFunction>
  clients: Set<number>
  onNextData?: Set<(err?: BasedErrorData<BasedErrorCode.FunctionError>) => void>
  payload: any
  diffCache?: Uint8Array
  cache?: Uint8Array
  rawData?: any
  previousChecksum?: number
  isDeflate?: boolean
  checksum?: number
  closeFunction?: () => void
  error?: BasedErrorData<BasedErrorCode.FunctionError> | null
  closeAfterIdleTime?: number
  timeTillDestroy: number | null
  isDestroyed: boolean
}
