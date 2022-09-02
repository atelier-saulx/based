import { BasedCoreClient } from '../'
import { AuthState, GenericObject } from '../types'
import {
  encodeAuthMessage,
  encodeFunctionMessage,
  encodeGetObserveMessage,
  encodeObserveMessage,
} from './messageEncoders'

const ping = new Uint8Array(0)

export const idleTimeout = (client: BasedCoreClient) => {
  const updateTime = 60 * 1e3
  clearTimeout(client.idlePing)
  client.idlePing = setTimeout(() => {
    if (
      client.connection &&
      client.connected &&
      !client.connection.disconnected
    ) {
      console.info(ping)
      client.connection.ws.send(ping)
    }
  }, updateTime)
}

export const drainQueue = (client: BasedCoreClient) => {
  if (
    client.connected &&
    !client.drainInProgress &&
    (client.functionQueue.length ||
      client.observeQueue.size ||
      client.getObserveQueue.size)
  ) {
    client.drainInProgress = true
    const drainOutgoing = () => {
      client.drainInProgress = false

      if (
        client.functionQueue.length ||
        client.observeQueue.size ||
        client.getObserveQueue.size
      ) {
        const fn = client.functionQueue
        const obs = client.observeQueue
        const get = client.getObserveQueue

        const buffs = []
        let l = 0

        // ------- GetObserve
        for (const [id, o] of get) {
          const { buffers, len } = encodeGetObserveMessage(id, o)
          buffs.push(...buffers)
          l += len
        }

        // ------- Observe
        for (const [id, o] of obs) {
          const { buffers, len } = encodeObserveMessage(id, o)
          buffs.push(...buffers)
          l += len
        }

        // ------- Function
        for (const f of fn) {
          const { buffers, len } = encodeFunctionMessage(f)
          buffs.push(...buffers)
          l += len
        }

        const n = new Uint8Array(l)
        let c = 0

        for (const b of buffs) {
          n.set(b, c)
          c += b.length
        }

        client.functionQueue = []
        client.observeQueue.clear()
        client.getObserveQueue.clear()

        client.connection.ws.send(n)
        idleTimeout(client)
      }
    }

    // if (client.authRequestId) {
    //   // TODO: add authInProgress?
    //   client.connection.ws.send(
    //     encodeAuthMessage(client.authRequestId, client.authRequest)
    //   )
    //   client.authRequestId = null
    // }
    if (client.authRequest?.inProgress) {
      client.authRequest.promise.then(() => {
        drainQueue(client)
      })
    } else {
      client.drainTimeout = setTimeout(drainOutgoing, 0)
    }
  }
}

export const stopDrainQueue = (client: BasedCoreClient) => {
  if (client.drainInProgress) {
    clearTimeout(client.drainTimeout)
    client.drainInProgress = false
  }
}

export const addToFunctionQueue = (
  client: BasedCoreClient,
  payload: GenericObject,
  name: string,
  resolve: (response: any) => void,
  reject: (err: Error) => void
) => {
  client.requestId++
  // 3 bytes
  if (client.requestId > 16777215) {
    client.requestId = 0
  }

  const id = client.requestId
  client.functionResponseListeners.set(id, [resolve, reject])
  client.functionQueue.push([id, name, payload])

  drainQueue(client)
}

export const addObsCloseToQueue = (
  client: BasedCoreClient,
  name: string,
  id: number
) => {
  const type = client.observeQueue.get(id)?.[0]
  if (type === 2) {
    return
  }
  client.observeQueue.set(id, [2, name])
  drainQueue(client)
}

export const addObsToQueue = (
  client: BasedCoreClient,
  name: string,
  id: number,
  payload: GenericObject,
  checksum: number = 0
) => {
  const type = client.observeQueue.get(id)?.[0]
  if (type === 1) {
    return
  }
  client.observeQueue.set(id, [1, name, checksum, payload])
  drainQueue(client)
}

// sub get queue
export const addGetToQueue = (
  client: BasedCoreClient,
  name: string,
  id: number,
  payload: GenericObject,
  checksum: number = 0
) => {
  if (client.getObserveQueue.has(id)) {
    return
  }
  client.getObserveQueue.set(id, [3, name, checksum, payload])
  drainQueue(client)
}

export const sendAuth = (client: BasedCoreClient, authState: AuthState) => {
  if (client.authRequest?.inProgress) {
    return client.authRequest.promise
  }

  client.authRequest.promise = new Promise<AuthState>((resolve, reject) => {
    client.authRequest.inProgress = true
    client.authRequest.resolve = resolve
    client.authRequest.reject = reject

    client.requestId++
    if (client.requestId > 16777215) {
      client.requestId = 0
    }
    client.authRequest.requestId = client.requestId
    client.authRequest.authState = authState

    const send = () => {
      if (!client.connected) {
        setTimeout(send, 0)
      } else {
        client.connection.ws.send(
          encodeAuthMessage(
            client.authRequest.requestId,
            client.authRequest.authState
          )
        )
      }
    }
    send()
  }).finally(() => {
    client.authRequest.requestId = null
    client.authRequest.authState = null
    client.authRequest.resolve = null
    client.authRequest.reject = null
    client.authRequest.inProgress = false
  })
  return client.authRequest.promise
}
