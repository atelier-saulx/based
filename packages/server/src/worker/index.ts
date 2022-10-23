import { parentPort } from 'node:worker_threads'
import {
  decodePayload,
  valueToBuffer,
  encodeFunctionResponse,
} from '../protocol'
import { createObs, closeObs } from './observable'

console.info('start function workerthread')

// will pack the total message (for ws and http)

// lets make shared buffer use 1 byte for method
// split this up as well

// have to authorize here...
parentPort.on('message', (d) => {
  if (d.type === 0) {
    // unregister fns also...
    const fn = require(d.path)

    let payload: any

    if (d.payload) {
      payload = decodePayload(d.payload, d.isDeflate)
    }

    fn(payload, d.context)
      .then((v) => {
        // only for WS
        // meta has to be send as well
        parentPort.postMessage({
          id: d.id,
          payload: encodeFunctionResponse(d.context.reqId, valueToBuffer(v)),
        })
      })
      .catch((err) => {
        parentPort.postMessage({
          id: d.id,
          err,
        })
      })
  } else if (d.type === 1) {
    createObs(d.id, d.path, d.payload)
    // make subscription
  } else if (d.type === 2) {
    closeObs(d.id)
    // close subscription
  }
})
