import { parentPort } from 'node:worker_threads'
import { createObs, closeObs } from './observable'
import wsFunction from './ws/function'
import httpFunction from './http/function'
import { fnPathMap, fnInstallListeners } from './functions'
import { state, authorize } from './authorize'
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
    // maybe if you install like this it gets marked for a bit longer
    // nested functions have to be kept in mem a bit longer...
    const x = fnInstallListeners.get(d.name)
    const prevPath = fnPathMap.get(d.name)
    if (prevPath) {
      delete require.cache[require.resolve(prevPath)]
    }
    fnPathMap.set(d.name, d.path)
    if (x) {
      let installedFn = require(d.path)
      if (installedFn.default) {
        installedFn = installedFn.default
      }

      x.forEach((r) => {
        r(installedFn)
      })
    }
    if (d.name === 'authorize') {
      const auth = require(d.path)
      state.authorize = auth.default || auth
    }
  } else if (d.type === 7) {
    const x = fnInstallListeners.get(d.name)
    const prevPath = fnPathMap.get(d.name)
    if (prevPath) {
      delete require.cache[require.resolve(prevPath)]
      fnPathMap.delete(d.path)
    }
    if (x) {
      const err = new Error(`Cannot install function ${d.name}`)
      x.forEach((r) => {
        r(undefined, err)
      })
    }
  } else if (d.type === 6) {
    const path = fnPathMap.get(d.name)
    if (!path) {
      return
    }
    fnPathMap.delete(path)
    delete require.cache[require.resolve(path)]
  } else if (d.type === 3 || d.type === 4) {
    const prevPath = fnPathMap.get(d.name)
    if (!prevPath) {
      fnPathMap.set(d.name, d.path)
    } else if (prevPath !== d.path) {
      delete require.cache[require.resolve(prevPath)]
    }
    httpFunction(d.name, d.type, d.path, d.id, d.context, d.payload)
  } else if (d.type === 0) {
    const prevPath = fnPathMap.get(d.name)
    if (!prevPath) {
      fnPathMap.set(d.name, d.path)
    } else if (prevPath !== d.path) {
      delete require.cache[require.resolve(prevPath)]
    }
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
    const prevPath = fnPathMap.get(d.name)
    if (!prevPath) {
      fnPathMap.set(d.name, d.path)
    } else if (prevPath !== d.path) {
      delete require.cache[require.resolve(prevPath)]
    }
    // payload is parsed for this
    createObs(d.id, d.path, d.payload)
  } else if (d.type === 2) {
    closeObs(d.id)
  }
})
