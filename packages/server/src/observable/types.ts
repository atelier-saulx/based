import { BasedError, BasedErrorCode } from '../error'

export type ObservableUpdateFunction = (
  data: any,
  checksum?: number,
  diff?: any,
  fromChecksum?: number,
  isDeflate?: boolean
) => void

export type ObserveErrorListener = (
  err: BasedError<BasedErrorCode.ObservableFunctionError>
) => void

export type ActiveObservable = {
  name: string
  id: number
  reusedCache: boolean
  functionObserveClients: Set<ObservableUpdateFunction> // kan ook normale functie zijn
  clients: Set<number>
  // listener too bad - but not really another option...
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