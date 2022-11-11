import {
  ClientContext,
  FunctionType,
  ObservableUpdateFunction, // and listener bit confuse...
  ObserveErrorListener,
} from '../types'
import { parentPort } from 'worker_threads'
import { installFunction } from './functions'
import { authorize } from './authorize'
import { readUint8, decodeHeader, decodePayload } from '../protocol'
import { BasedError, BasedErrorCode, ErrorPayload } from '../main/error'
import genObservableId from '../genObservableId'

export const runFunction = async (
  name: string,
  payload: any,
  context: ClientContext
): Promise<any> => {
  const ok = await authorize(context, name, payload)
  if (!ok) {
    throw new Error('Not auth')
  }
  const fn = await installFunction(name, FunctionType.function)
  return fn(payload, context)
}

let obsIds = 0

type ActiveNestedObservers = Map<
  number,
  {
    onData: ObservableUpdateFunction
    onError: ObserveErrorListener
  }
>

const activeObservables: Map<number, ActiveNestedObservers> = new Map()

// run authorize here
export const observe = (
  name: string,
  payload: any,
  context: ClientContext,
  onData: ObservableUpdateFunction,
  onError?: ObserveErrorListener
): (() => void) => {
  const id = genObservableId(name, payload)

  const observerId = ++obsIds

  let isRemoved = false
  authorize(context, name, payload)
    .then((ok) => {
      if (isRemoved) {
        return
      }
      let observers: ActiveNestedObservers = activeObservables.get(id)

      if (!ok) {
        console.error('OBS - need to error! no auth for you!', name)
        // TODO: send up
        return
      }

      if (!observers) {
        observers = new Map()
        activeObservables.set(id, observers)
      }

      observers.set(observerId, {
        onData,
        onError: onError || (() => {}),
      })

      parentPort.postMessage({
        type: 1,
        payload,
        name,
        context: {},
        id,
      })
    })
    .catch((err) => {
      if (isRemoved) {
        return
      }
      // TODO: send up
      console.error('Wrong auth obs - send up - authorize!', name, err)
    })

  return () => {
    if (isRemoved) {
      return
    }
    const observers: ActiveNestedObservers = activeObservables.get(id)
    isRemoved = true
    observers.delete(observerId)
    if (observers.size === 0) {
      parentPort.postMessage({
        type: 2,
        context: {},
        id,
      })
      activeObservables.delete(id)
    }
  }
}

export const get = (
  name: string,
  payload: any,
  context: ClientContext
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const close = observe(
      name,
      payload,
      context,
      (data) => {
        close()
        resolve(data)
      },
      (err) => {
        close()
        reject(err)
      }
    )
  })
}

export const incomingObserve = (
  id: number,
  checksum?: number,
  data?: Uint8Array,
  err?: BasedError<BasedErrorCode.ObservableFunctionError>,
  diff?: Uint8Array,
  previousChecksum?: number,
  isDeflate?: boolean
) => {
  const obs = activeObservables.get(id)

  if (obs) {
    obs.forEach(({ onData, onError }) => {
      if (err) {
        onError(err)
      } else {
        // @ts-ignore
        if (onData.__isEdge__) {
          onData(data, checksum, diff, previousChecksum, isDeflate)
        } else {
          try {
            onData(data, checksum, diff, previousChecksum, isDeflate)
          } catch (err) {
            workerError(BasedErrorCode.ObserveCallbackError, {
              err,
              observableId: id,
            })
          }
        }
      }
    })
  }
}

export const decode = (buffer: Uint8Array): any => {
  const header = readUint8(buffer, 0, 4)
  const { isDeflate, len, type } = decodeHeader(header)
  if (type === 1) {
    // | 4 header | 8 id | 8 checksum | * payload |
    if (len === 16) {
      return
    }
    const start = 20
    const end = len + 4
    return decodePayload(buffer.slice(start, end), isDeflate)
  }
  // decode diff as well
}

export const workerLog = (log: any, context?: ClientContext) => {
  parentPort.postMessage({
    type: 4,
    log,
    context,
  })
}

export function workerError<T extends BasedErrorCode>(
  code: T,
  payload: ErrorPayload[T],
  context?: ClientContext
) {
  parentPort.postMessage({
    type: 5,
    code,
    payload,
    context,
  })
}
