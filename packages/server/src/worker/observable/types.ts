import { BasedError, BasedErrorCode } from '../../error'

export type ActiveObservable = {
  name: string
  id: number
  reusedCache: boolean
  isDestroyed: boolean
  diffCache?: Uint8Array
  cache?: Uint8Array
  previousChecksum?: number
  isDeflate?: boolean
  checksum?: number
  closeFunction?: () => void
  beingDestroyed?: NodeJS.Timeout
  onNextData?: Set<
    (err?: BasedError<BasedErrorCode.ObservableFunctionError>) => void
  >
  error?: BasedError<BasedErrorCode.ObservableFunctionError> | null
}

// subscribers?
