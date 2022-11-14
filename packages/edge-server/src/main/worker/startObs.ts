import { BasedObservableFunctionSpec, BasedWorker } from '../../types'
import { BasedErrorCode, BasedError } from '../../error'
import { BasedServer } from '../server'
import { sendToWorker } from './send'
import { IncomingType } from '../../worker/types'

export const startObs = (
  server: BasedServer,
  spec: BasedObservableFunctionSpec,
  id: number,
  error: (err: BasedError<BasedErrorCode.ObservableFunctionError>) => void,
  update: (
    encodedDiffData: Uint8Array,
    encodedData: Uint8Array,
    checksum: number,
    isDeflate: boolean,
    reusedCache: boolean
  ) => void,
  payload?: any
): (() => void) => {
  // TODO: move selection criteria etc to other file
  const selectedWorker: BasedWorker = server.functions.lowestWorker
  server.functions.workerResponseListeners.set(id, (err, p) => {
    if (err) {
      if (err.code === BasedErrorCode.ObservableFunctionError) {
        // @ts-ignore TODO: make an error check funciton....
        error(err)
      }
    } else {
      update(p.diff, p.data, p.checksum, p.isDeflate, p.reusedCache)
    }
  })

  sendToWorker(selectedWorker, {
    type: IncomingType.CreateObs,
    id,
    name: spec.name,
    path: spec.functionPath,
    payload,
  })

  return () => {
    server.functions.workerResponseListeners.delete(id)
    sendToWorker(selectedWorker, { type: IncomingType.CloseObs, id })
  }
}
