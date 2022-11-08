// external api
import { ClientContext, ObservableUpdateFunction } from '../types'
import { parentPort } from 'worker_threads'
import { fnPathMap, fnInstallListeners } from './functions'
import { authorize } from './authorize'
import { hashObjectIgnoreKeyOrder } from '@saulx/hash'
import { readUint8, decodeHeader, decodePayload } from '../protocol'

export type ObserveErrorListener = (err: Error) => void

export const genObserveId = (name: string, payload: any): number => {
  return hashObjectIgnoreKeyOrder([name, payload])
}

const nestedRunFunction = async (
  name: string,
  fn: Function,
  context: ClientContext,
  payload: any
) => {
  const ok = await authorize(context, name, payload)
  if (!ok) {
    throw new Error('Not auth')
  }
  return fn(payload, context)
}

// TODO: Rename clientContext to context OR add one specially for nested observable contexts
export const runFunction = (
  name: string,
  payload: any,
  context: ClientContext
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const prevPath = fnPathMap.get(name)
    if (prevPath) {
      let fn = require(prevPath)
      if (fn.default) {
        fn = fn.default
      }
      resolve(nestedRunFunction(name, fn, context, payload))
    } else {
      let listeners = fnInstallListeners.get(name)
      if (!listeners) {
        listeners = []
        fnInstallListeners.set(name, listeners)
      }
      listeners.push((fn: Function, err) => {
        if (err) {
          reject(err)
        } else {
          resolve(nestedRunFunction(name, fn, context, payload))
        }
      })
      parentPort.postMessage({
        type: 0,
        name,
      })
    }
  })
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
  const id = genObserveId(name, payload)
  const observerId = ++obsIds
  let observers: ActiveNestedObservers = activeObservables.get(id)

  authorize(context, name, payload)
    .then((ok) => {
      if (!ok) {
        console.error('no auth for you!', name)
        return
      }

      if (!observers) {
        observers = new Map()
        activeObservables.set(id, observers)
        parentPort.postMessage({
          type: 1,
          payload,
          name,
          context: {},
          id,
        })
      }

      observers.set(observerId, {
        onData,
        onError: onError || (() => {}),
      })
    })
    .catch((err) => {
      console.error('wrong authorize!', name, err)
    })

  return () => {
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
  err?: Error,
  diff?: Uint8Array,
  previousChecksum?: number
) => {
  const obs = activeObservables.get(id)
  if (obs) {
    obs.forEach(({ onData, onError }) => {
      if (err) {
        onError(err)
      } else {
        onData(data, checksum, diff, previousChecksum)
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
