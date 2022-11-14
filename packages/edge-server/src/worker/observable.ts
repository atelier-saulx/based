import {
  valueToBuffer,
  encodeObservableResponse,
  encodeObservableDiffResponse,
} from '../protocol'
import { FunctionType, ObservableUpdateFunction } from '../types'
import { hashObjectIgnoreKeyOrder, hash } from '@saulx/hash'
import { deepCopy } from '@saulx/utils'
import createPatch from '@saulx/diff'
import { getFunction } from './functions'
import { Incoming, IncomingType, OutgoingType } from './types'
import send from './send'

export type WorkerObs = {
  id: number
  isDestroyed: boolean
  rawData?: any // deepCopy - can be heavy...
  rawDataSize?: number
  diffCache?: Uint8Array
  previousChecksum?: number
  cache?: Uint8Array
  isDeflate?: boolean
  checksum?: number
  reusedCache?: boolean
  closeFunction?: () => void
}

export const activeObs: Map<number, WorkerObs> = new Map()

export const createObs = ({
  id,
  name,
  path,
  payload,
}: Incoming[IncomingType.CreateObs]) => {
  if (activeObs.has(id)) {
    console.warn('Trying to create an obs that allready exists...')
    return
  }

  const obs: WorkerObs = {
    id,
    isDestroyed: false,
  }

  activeObs.set(id, obs)

  const fn = getFunction(name, FunctionType.observe, path)

  const update: ObservableUpdateFunction = (
    data: any,
    checksum?: number,
    diff?: any,
    previousChecksum?: number,
    isDeflate?: boolean
  ) => {
    if (checksum === undefined) {
      if (data === undefined) {
        checksum = 0
      } else {
        if (typeof data === 'object' && data !== null) {
          checksum = hashObjectIgnoreKeyOrder(data)
        } else {
          checksum = hash(data)
        }
      }
    }

    if (checksum !== obs.checksum) {
      let encodedData: Uint8Array
      if (data instanceof Uint8Array) {
        obs.reusedCache = true
        encodedData = data
        if (diff) {
          obs.diffCache = diff
          obs.previousChecksum = previousChecksum
        }
        if (!isDeflate) {
          isDeflate = false
        }
      } else {
        obs.reusedCache = false
        const buff = valueToBuffer(data)

        if (previousChecksum === undefined) {
          if (typeof data === 'object' && data !== null) {
            if (obs.rawData) {
              diff = createPatch(obs.rawData, data)
              obs.previousChecksum = obs.checksum
            }
            obs.rawData = deepCopy(data)
          } else if (obs.rawData) {
            delete obs.rawData
            delete obs.rawDataSize
          }
        }

        // keep track globally of total mem usage
        ;[encodedData, isDeflate] = encodeObservableResponse(id, checksum, buff)

        if (diff) {
          const diffBuff = valueToBuffer(diff)
          const encodedDiffData = encodeObservableDiffResponse(
            id,
            checksum,
            obs.previousChecksum,
            diffBuff
          )
          obs.diffCache = encodedDiffData
        }
      }

      obs.isDeflate = isDeflate
      obs.cache = encodedData
      obs.checksum = checksum

      send({
        type: OutgoingType.ObservableUpdate,
        id,
        payload: {
          diff: obs.diffCache,
          data: encodedData,
          checksum: checksum,
          isDeflate: isDeflate,
          reusedCache: obs.reusedCache,
        },
      })
    }
  }

  // @ts-ignore
  update.__isEdge__ = true

  // add onError function to observe api...
  // support both async and sync fns
  try {
    const r = fn(payload, update)
    if (r instanceof Promise) {
      r.then((close) => {
        if (obs.isDestroyed) {
          close()
        } else {
          obs.closeFunction = close
        }
      }).catch((err) => {
        send({
          type: OutgoingType.ObservableUpdate,
          id,
          err,
        })
      })
    } else {
      obs.closeFunction = r
    }
  } catch (err) {
    send({
      type: OutgoingType.ObservableUpdate,
      id,
      err,
    })
  }
}

export const closeObs = (id: number) => {
  const obs = activeObs.get(id)

  if (!obs) {
    console.warn('Trying to close an obs that does not exist')
    return
  }

  obs.isDestroyed = true
  if (obs.closeFunction) {
    obs.closeFunction()
  }
  activeObs.delete(id)
}
