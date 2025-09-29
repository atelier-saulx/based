import { BasedErrorCode, BasedErrorData } from '@based/errors'
import {
  BasedQueryFunctionConfig,
  BasedRoute,
  ObservableUpdateFunction,
} from '@based/functions'

export type ObservableError =
  | BasedErrorData<BasedErrorCode.FunctionError>
  | BasedErrorData<BasedErrorCode.FunctionIsWrongType>
  | BasedErrorData<BasedErrorCode.FunctionNotFound>

export type ServerObserveErrorListener = (err: ObservableError) => void

export type ActiveObservable = {
  startId: number
  route: BasedRoute<'query'>
  id: number
  reusedCache: boolean
  functionObserveClients: Set<ObservableUpdateFunction>
  clients: Set<number>
  oldClients?: Set<number>
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
  attachedCtx?: AttachedCtx
}

export type AttachedCtx = {
  ctx: { [key: string]: any }
  id: number
  authState: boolean
  fromId: number
}
