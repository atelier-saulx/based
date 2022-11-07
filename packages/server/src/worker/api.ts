// external api
import { ClientContext, ObservableUpdateFunction } from '../types'
import { parentPort, workerData } from 'worker_threads'
import { fnPathMap, fnInstallListeners } from './functions'
import { authorize } from './authorize'
import { hashObjectIgnoreKeyOrder } from '@saulx/hash'

const { functionApiWrapperPath } = workerData
const fnWrapper = require(functionApiWrapperPath).runFunction

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
  return fnWrapper(name, fn, payload, context)
}

export const runFunction = (
  name: string,
  payload: any,
  context: ClientContext
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const prevPath = fnPathMap.get(name)
    if (prevPath) {
      const fn = require(prevPath)
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

// activeObservables

let obsIds = 0

type ActiveNestedObservers = Map<
  number,
  {
    onData: ObservableUpdateFunction
    onError: ObserveErrorListener
  }
>

const activeObservables: Map<number, ActiveNestedObservers> = new Map()

export const observe = (
  name: string,
  payload: any,
  context: ClientContext | {},
  onData: ObservableUpdateFunction,
  onError?: ObserveErrorListener
): (() => void) => {
  const id = genObserveId(name, payload)
  const observerId = ++obsIds

  let observers: ActiveNestedObservers = activeObservables.get(id)

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

export const incomingObserve = (
  id: number,
  checksum?: number,
  data?: Uint8Array,
  err?: Error,
  diff?: Uint8Array,
  previousChecksum?: number
  // d.diff, d.previousChecksum
) => {
  const obs = activeObservables.get(id)
  if (obs) {
    obs.forEach(({ onData, onError }) => {
      if (err) {
        onError(err)
      } else {
        // console.info('DURK', data, checksum, diff, previousChecksum)
        onData(data, checksum, diff, previousChecksum)
      }
    })
  }
}
