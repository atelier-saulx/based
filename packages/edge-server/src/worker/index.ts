import { parentPort } from 'node:worker_threads'
import { createObs, closeObs } from './observable'
import wsFunction from './ws/function'
import httpFunction from './http/function'
import { addFunction, removeFunction, errorInstallFunction } from './functions'
import { authorize } from './authorize'
import { incomingObserve } from './api'

export * from './api'

// outgoing type: 0 => install function
// outgoing type: 1 => GET
// outgoing type: 2 => OBSERVE

parentPort.on('message', (d) => {
  // d.type === 3 // HTTP POST FN
  // d.type === 4 // HTTP GET FN
  // d.type === 5 // FN INSTALLED (can be observable as well)
  // d.type === 6 // UNINSTALL FN
  // d.type === 7 // CANNOT INSTALL FN
  // d.type === 8 // OBSERVABLE UPDATE
  // d.type === 9 // AUTHORIZE

  if (d.type === 9) {
    authorize(d.context, d.name, d.payload)
      .then((ok) => {
        parentPort.postMessage({
          id: d.id,
          payload: ok,
        })
      })
      .catch((err) => {
        parentPort.postMessage({
          id: d.id,
          err,
        })
      })
  } else if (d.type === 8) {
    incomingObserve(d.id, d.checksum, d.data, d.err, d.diff, d.previousChecksum)
  } else if (d.type === 5) {
    addFunction(d.name, d.path)
  } else if (d.type === 7) {
    errorInstallFunction(d.name)
  } else if (d.type === 6) {
    removeFunction(d.name)
  } else if (d.type === 3 || d.type === 4) {
    addFunction(d.name, d.path)
    httpFunction(d.name, d.type, d.path, d.id, d.context, d.payload)
  } else if (d.type === 0) {
    addFunction(d.name, d.path)
    wsFunction(
      d.name,
      d.path,
      d.id,
      d.context.reqId,
      d.context,
      d.context.isDeflate,
      d.payload
    )
  } else if (d.type === 1) {
    addFunction(d.name, d.path)
    createObs(d.name, d.id, d.path, d.payload)
  } else if (d.type === 2) {
    closeObs(d.id)
  }
})
