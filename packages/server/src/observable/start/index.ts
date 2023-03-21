import { BasedServer } from '../../server'
import { isQueryFunctionSpec } from '../../functions'
import { updateListener } from './update'
import { errorListener } from './error'
import { ObservableUpdateFunction } from '../types'

export const start = (server: BasedServer, id: number) => {
  const obs = server.activeObservablesById.get(id)

  if (obs.closeFunction) {
    obs.closeFunction()
    delete obs.closeFunction
  }

  const spec = server.functions.specs[obs.name]

  if (!spec || !isQueryFunctionSpec(spec)) {
    console.warn('Cannot find observable function spec!', obs.name)
    return
  }

  const payload = obs.payload

  const update: ObservableUpdateFunction = (
    data,
    checksum,
    err,
    cache,
    diff,
    fromChecksum,
    isDeflate
  ) => {
    if (err) {
      errorListener(server, obs, err)
      return
    }
    updateListener(
      server,
      obs,
      data,
      checksum,
      cache,
      diff,
      fromChecksum,
      isDeflate
    )
  }

  const startId = ++obs.startId

  try {
    const r = spec.function(server.client, payload, update, (err) => {
      errorListener(server, obs, err)
    })
    if (r instanceof Promise) {
      r.then((close) => {
        if (obs.isDestroyed || startId !== obs.startId) {
          close()
        } else {
          obs.closeFunction = close
        }
      }).catch((err) => {
        if (!(obs.isDestroyed || startId !== obs.startId)) {
          errorListener(server, obs, err)
        }
      })
    } else {
      obs.closeFunction = r
    }
  } catch (err) {
    if (!(obs.isDestroyed || startId !== obs.startId)) {
      errorListener(server, obs, err)
    }
  }
}
