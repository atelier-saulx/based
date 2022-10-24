import { parentPort } from 'node:worker_threads'
import { createObs, closeObs } from './observable'
import wsFunction from './ws/function'

console.info('Start worker')

parentPort.on('message', (d) => {
  // d.type === 3 // HTTP POST FN
  // d.type === 4 // HTTP GET FN

  if (d.type === 0) {
    wsFunction(d.path, d.id, d.reqId, d.isDeflate, d.payload)
  } else if (d.type === 1) {
    // payload is parsed for this
    createObs(d.id, d.path, d.payload)
  } else if (d.type === 2) {
    closeObs(d.id)
  }
})
