import { BasedErrorCode, BasedErrorData } from '@based/errors'

export type ObservableError =
  | BasedErrorData<BasedErrorCode.FunctionError>
  | BasedErrorData<BasedErrorCode.FunctionIsWrongType>
  | BasedErrorData<BasedErrorCode.FunctionNotFound>

export type ObservableUpdateFunction = (
  data: any,
  checksum?: number,
  err?: null | ObservableError,
  cache?: Uint8Array,
  diff?: any,
  fromChecksum?: number,
  isDeflate?: boolean,
) => void

export type ObserveErrorListener = (err: ObservableError) => void

export type ActiveObservable = {
  startId: number
  name: string
  id: number
  reusedCache: boolean
  functionObserveClients: Set<ObservableUpdateFunction>
  clients: Set<number>
  onNextData?: Set<(err?: ObservableError) => void>
  payload: any
  diffCache?: Uint8Array
  cache?: Uint8Array
  rawData?: any
  previousChecksum?: number
  isDeflate?: boolean
  checksum?: number
  closeFunction?: () => void
  error?: ObservableError | null
  closeAfterIdleTime?: number
  timeTillDestroy: number | null
  isDestroyed: boolean
}
