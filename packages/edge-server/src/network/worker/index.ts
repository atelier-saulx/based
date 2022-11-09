import { BasedServer } from '../../server'
import { BasedWorker } from '../../types'
import { subscribe, unsubscribe } from './observable'

export const workerMessage = (
  server: BasedServer,
  worker: BasedWorker,
  data: any
) => {
  // type 0 install fn
  // type 1 Subscribe
  // type 2 Unsubscribe
  // type 3 Get
  // type 4 log

  // TODO: Handle errors if wrong send back error
  // something like an error channel can also send the error back to the subscription update..
  if (data.type === 2) {
    // close
    unsubscribe(
      {
        worker,
        context: data.context,
      },
      data.id,
      server
    )
  } else if (data.type === 1) {
    // SUBSCRIBE
    subscribe(
      data.name,
      data.payload,
      data.id,
      {
        worker,
        context: data.context,
      },
      server
    )
  } else if (data.type === 0) {
    server.functions
      .install(data.name)
      .then((spec) => {
        if (spec) {
          worker.worker.postMessage({
            type: 5,
            name: spec.name,
            path: spec.functionPath,
          })
        } else {
          worker.worker.postMessage({
            type: 7,
            name: data.name,
          })
        }
      })
      .catch(() => {
        worker.worker.postMessage({
          type: 7,
          name: data.name,
        })
      })
  } else if (data.type === 4) {
    server.emit(
      'log',
      {
        worker,
        context: data.context || {},
      },
      data.log
    )
  } else if (data.id) {
    const listener = server.functions.workerResponseListeners.get(data.id)
    if (listener) {
      if (data.errCode) {
        if (!data.err) {
          data.err = new Error()
        }
        data.err.code = data.errCode
      }

      listener(data.err, data.payload)
    }
  }
}
