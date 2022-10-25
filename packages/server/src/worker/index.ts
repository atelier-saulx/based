import { parentPort, threadId } from 'node:worker_threads'
import { createObs, closeObs } from './observable'
import wsFunction from './ws/function'
import { fnPathMap, fnInstallListeners } from './functions'

console.info('Start worker', threadId)

// outgoing type: 0 => install function
// outgoing type: 1 => GET
// outgoing type: 2 => OBSERVE

parentPort.on('message', (d) => {
  // d.type === 3 // HTTP POST FN
  // d.type === 4 // HTTP GET FN
  // d.type === 5 // FN INSTALLED (can be observable as well)
  // d.type === 6 // UNINSTALL FN
  // d.type === 7 // CANNOT INSTALL FN

  if (d.type === 5) {
    // maybe if you install like this it gets marked for a bit longer
    // nested functions have to be kept in mem a bit longer...
    const x = fnInstallListeners.get(d.name)
    fnPathMap.set(d.name, d.path)
    if (x) {
      const installedFn = require(d.path)
      x.forEach((r) => {
        r(installedFn)
      })
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
      console.info('Cannot find path to uninstall', d.name)
      return
    }
    console.info('Uninstall', d.name)
    fnPathMap.delete(path)
    delete require.cache[require.resolve(path)]
  } else if (d.type === 5) {
    // means got something reinstalled OR installed
    // can update listeners for fns being installed
  } else if (d.type === 0) {
    const prevPath = fnPathMap.get(d.name)
    if (!prevPath) {
      fnPathMap.set(d.name, d.path)
    } else if (prevPath !== d.path) {
      delete require.cache[require.resolve(prevPath)]
    }
    wsFunction(d.path, d.id, d.reqId, d.isDeflate, d.payload)
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
