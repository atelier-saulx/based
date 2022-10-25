import { parentPort, threadId } from 'node:worker_threads'
import { createObs, closeObs } from './observable'
import wsFunction from './ws/function'
import fnMap from './fnMap'

console.info('Start worker', threadId)

parentPort.on('message', (d) => {
  // d.type === 3 // HTTP POST FN
  // d.type === 4 // HTTP GET FN
  // d.type === 5 // FN INSTALLED (can be observable as well)
  // d.type === 6 // UNINSTALL FN

  if (d.type === 6) {
    const path = fnMap.get(d.name)
    if (!path) {
      console.info('Cannot find path', path)
      return
    }
    fnMap.delete(path)
    delete require.cache[require.resolve(path)]
  } else if (d.type === 5) {
    // means got something reinstalled OR installed
    // can update listeners for fns being installed
  } else if (d.type === 0) {
    const prevPath = fnMap.get(d.name)
    if (!prevPath) {
      fnMap.set(d.name, d.path)
    } else if (prevPath !== d.path) {
      delete require.cache[require.resolve(prevPath)]
    }
    wsFunction(d.path, d.id, d.reqId, d.isDeflate, d.payload)
  } else if (d.type === 1) {
    // payload is parsed for this
    createObs(d.id, d.path, d.payload)
  } else if (d.type === 2) {
    closeObs(d.id)
  }
})
