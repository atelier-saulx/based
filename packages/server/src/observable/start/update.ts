import { ActiveObservable } from '../types'
import {
  updateId,
  valueToBuffer,
  encodeObservableResponse,
  encodeObservableDiffResponse,
} from '../../protocol'
import { deepCopy } from '@saulx/utils'
import { hashObjectIgnoreKeyOrder, hash } from '@saulx/hash'
import { createPatch } from '@saulx/diff'
import { BasedServer } from '../../server'

export const updateListener = (
  server: BasedServer,
  obs: ActiveObservable,
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
        }
      }

      // keep track globally of total mem usage
      ;[encodedData, isDeflate] = encodeObservableResponse(
        obs.id,
        checksum,
        buff
      )

      if (diff) {
        const diffBuff = valueToBuffer(diff)
        const encodedDiffData = encodeObservableDiffResponse(
          obs.id,
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

    let prevId: Uint8Array
    let prevDiffId: Uint8Array

    if (obs.clients.size) {
      if (obs.diffCache) {
        if (obs.reusedCache) {
          prevDiffId = updateId(obs.diffCache, obs.id)
        }
        server.uwsApp.publish(String(obs.id), obs.diffCache, true, false)
      } else {
        if (obs.reusedCache) {
          prevId = updateId(encodedData, obs.id)
        }
        server.uwsApp.publish(String(obs.id), encodedData, true, false)
      }
    }

    if (obs.functionObserveClients.size) {
      obs.functionObserveClients.forEach((fnUpdate) => {
        fnUpdate(
          obs.cache,
          obs.checksum,
          obs.diffCache,
          obs.previousChecksum,
          obs.isDeflate
        )
      })
    }

    if (obs.onNextData) {
      const onNextData = obs.onNextData
      delete obs.onNextData
      onNextData.forEach((fn) => fn())
    }

    if (prevDiffId) {
      obs.diffCache.set(prevDiffId, 4)
    }
    if (prevId) {
      encodedData.set(prevId, 4)
    }
  }
}

updateListener.__isEdge__ = true
