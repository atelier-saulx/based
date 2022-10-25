import {
  valueToBuffer,
  encodeObservableResponse,
  encodeObservableDiffResponse,
} from '../protocol'
import { ObservableUpdateFunction } from '../types'
import { hashObjectIgnoreKeyOrder, hash } from '@saulx/hash'
import { deepCopy } from '@saulx/utils'
import createPatch from '@saulx/diff'
import { parentPort } from 'node:worker_threads'

export type WorkerObs = {
  id: number
  isDestroyed: boolean
  rawData?: any // deepCopy
  rawDataSize?: number
  diffCache?: Uint8Array
  previousChecksum?: number
  cache?: Uint8Array
  isDeflate?: boolean
  checksum?: number
  closeFunction?: () => void
}

export const activeObs: Map<number, WorkerObs> = new Map()

export const createObs = (id: number, functionPath: string, payload?: any) => {
  if (activeObs.has(id)) {
    console.warn('trying to creater an obs that allready exists...')
    return
  }

  const obs: WorkerObs = {
    id,
    isDestroyed: false,
  }

  activeObs.set(id, obs)

  const fn = require(functionPath)

  const update: ObservableUpdateFunction = (
    data: any,
    checksum?: number,
    diff?: any,
    previousChecksum?: number
  ) => {
    if (checksum === undefined) {
      if (data === undefined) {
        checksum = 0
      } else {
        // do something
        if (typeof data === 'object' && data !== null) {
          checksum = hashObjectIgnoreKeyOrder(data)
        } else {
          checksum = hash(data)
        }
      }
    }

    if (checksum !== obs.checksum) {
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

      // TODO: this will all become SHAREDBUFFERS

      // keep track globally of total mem usage
      const [encodedData, isDeflate] = encodeObservableResponse(
        id,
        checksum,
        buff
      )
      // add deflate info
      obs.isDeflate = isDeflate
      obs.cache = encodedData
      obs.checksum = checksum

      if (diff) {
        const diffBuff = valueToBuffer(diff)
        const encodedDiffData = encodeObservableDiffResponse(
          id,
          checksum,
          obs.previousChecksum,
          diffBuff
        )
        obs.diffCache = encodedDiffData
        // add to cache size
      }

      parentPort.postMessage({
        id,
        payload: {
          diff: obs.diffCache,
          data: encodedData,
          checksum: checksum,
          isDeflate: isDeflate,
        },
      })
    }
  }

  fn(payload, update)
    .then((close) => {
      if (obs.isDestroyed) {
        close()
      } else {
        obs.closeFunction = close
      }
    })
    .catch((err) => {
      parentPort.postMessage({
        id,
        err,
      })
      // TODO: maybe clear instantly?
    })
}

export const closeObs = (id: number) => {
  const obs = activeObs.get(id)

  if (!obs) {
    console.warn('trying to close an obs that does not exist')
    return
  }

  obs.isDestroyed = true
  if (obs.closeFunction) {
    obs.closeFunction()
  }
  activeObs.delete(id)
}

// make a map
