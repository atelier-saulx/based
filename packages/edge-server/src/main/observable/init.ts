import { BasedServer } from '../server'
import { encodeErrorResponse, updateId, valueToBuffer } from '../../protocol'
import { createError } from '../../error'
import { ObservableDummyClient } from '../../types'
import { startObs } from '../worker'

const dummyClient: ObservableDummyClient = {
  isDummy: true,
  context: {
    query: '',
    ip: '',
    id: -1,
    ua: '',
    method: 'dummy',
    headers: {},
  },
}

export const initFunction = async (
  server: BasedServer,
  id: number
): Promise<void> => {
  const obs = server.activeObservablesById.get(id)

  if (obs.closeFunction) {
    obs.closeFunction()
    delete obs.closeFunction
  }

  const spec = server.functions.observables[obs.name]

  if (!spec) {
    console.warn('Cannot find observable function spec!', obs.name)
    return
  }

  const payload = obs.payload

  const close = startObs(
    server,
    spec,
    id,
    (err) => {
      obs.error = err
      delete obs.cache
      delete obs.diffCache
      delete obs.checksum
      delete obs.previousChecksum

      obs.isDeflate = false
      obs.reusedCache = false

      const errorData = createError(server, dummyClient, err.code, {
        err,
        observableId: id,
        route: {
          name: obs.name,
        },
      })

      if (obs.clients.size) {
        server.uwsApp.publish(
          String(id),
          encodeErrorResponse(valueToBuffer(errorData)),
          true,
          false
        )
      }

      if (obs.workers.size) {
        obs.workers.forEach((w) => {
          w.worker.postMessage({
            type: 8,
            id,
            err,
          })
        })
      }

      if (obs.onNextData) {
        const onNextData = obs.onNextData
        delete obs.onNextData
        onNextData.forEach((fn) => fn(err))
      }
    },
    (encodedDiffData, encodedData, checksum, isDeflate, reusedCache) => {
      obs.error = null
      obs.previousChecksum = obs.checksum
      obs.checksum = checksum
      obs.cache = encodedData
      obs.isDeflate = isDeflate
      obs.reusedCache = reusedCache || false

      if (encodedDiffData) {
        obs.diffCache = encodedDiffData
      }

      let prevId: Uint8Array
      let prevDiffId: Uint8Array

      if (obs.clients.size) {
        if (encodedDiffData) {
          if (reusedCache) {
            prevDiffId = updateId(encodedDiffData, id)
          }
          server.uwsApp.publish(String(id), encodedDiffData, true, false)
        } else {
          if (reusedCache) {
            prevId = updateId(encodedData, id)
          }
          server.uwsApp.publish(String(id), encodedData, true, false)
        }
      }

      if (obs.workers.size) {
        obs.workers.forEach((w) => {
          w.worker.postMessage({
            type: 8,
            id,
            checksum,
            diff: encodedDiffData,
            previousChecksum: obs.previousChecksum,
            data: obs.cache,
            isDeflate: obs.isDeflate,
            reusedCache: obs.reusedCache,
          })
        })
      }

      if (obs.onNextData) {
        const onNextData = obs.onNextData
        delete obs.onNextData
        onNextData.forEach((fn) => fn())
      }

      if (prevDiffId) {
        encodedDiffData.set(prevDiffId, 4)
      }
      if (prevId) {
        encodedData.set(prevId, 4)
      }
    },
    payload
  )
  if (obs.isDestroyed) {
    close()
  } else {
    obs.closeFunction = close
  }
}
