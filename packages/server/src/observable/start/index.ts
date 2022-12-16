import { BasedServer } from '../../server'
import { isObservableFunctionSpec } from '../../functions'
import { updateListener } from './update'
import { errorListener } from './error'

export const start = (server: BasedServer, id: number) => {
  const obs = server.activeObservablesById.get(id)

  if (obs.closeFunction) {
    obs.closeFunction()
    delete obs.closeFunction
  }

  const spec = server.functions.specs[obs.name]

  if (!spec || !isObservableFunctionSpec(spec)) {
    console.warn('Cannot find observable function spec!', obs.name)
    return
  }

  const payload = obs.payload

  const update = (data, checksum, diff, fromChecksum, isDeflate) =>
    updateListener(server, obs, data, checksum, diff, fromChecksum, isDeflate)

  update.__internalObs__ = true

  try {
    // TODO: make these functions receive server and obs (as last args) - every fn that you dont need is WIN
    const r = spec.function(payload, update)

    if (r instanceof Promise) {
      r.then((close) => {
        if (obs.isDestroyed) {
          close()
        } else {
          obs.closeFunction = close
        }
      }).catch((err) => {
        errorListener(server, obs, err)
      })
    } else {
      obs.closeFunction = r
    }
  } catch (err) {
    errorListener(server, obs, err)
  }
}
