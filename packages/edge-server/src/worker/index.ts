import { parentPort } from 'node:worker_threads'
import { createObs, closeObs } from './observable'
import wsFunction from './ws/function'
import httpFunction from './http/function'
import { addFunction, removeFunction, errorInstallFunction } from './functions'
import { incomingAuthorize } from './authorize'
import { incomingObserve } from './api'

export * from './api'

parentPort.on('message', (d) => {
  // 1 CREATE OBS
  // 2 CLOSE OBS
  // 3 HTTP POST FN
  // 4 HTTP GET FN
  // 5 FN INSTALLED (can be observable as well)
  // 6 UNINSTALL FN
  // 7 CANNOT INSTALL FN
  // 8 OBSERVABLE UPDATE
  // 9 AUTHORIZE

  if (d.type === 9) {
    incomingAuthorize(d)
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
