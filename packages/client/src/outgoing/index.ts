import { BasedClient } from '..'
import { AuthState, GenericObject } from '../types'
import {
  encodeAuthMessage,
  encodeFunctionMessage,
  encodeGetObserveMessage,
  encodeObserveMessage,
} from './messageEncoders'
import { deepEqual } from '@saulx/utils'

const ping = new Uint8Array(0)

export const idleTimeout = (client: BasedClient) => {
  const updateTime = 60 * 1e3
  clearTimeout(client.idlePing)
  client.idlePing = setTimeout(() => {
    if (
      client.connection &&
      client.connected &&
      !client.connection.disconnected
    ) {
      client.connection.ws.send(ping)
    }
  }, updateTime)
}

export const drainQueue = (client: BasedClient) => {
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

      if (!client.connected) {
        return
      }

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

    // This can be removed scince we allways send it before the queue - dont need to wait for reply...
    // if (client.authRequest?.inProgress) {
    //   client.authRequest.promise.then(() => {
    //     drainQueue(client)
    //   })
    // } else {
    client.drainTimeout = setTimeout(drainOutgoing, 0)
    // }
  }
}

export const stopDrainQueue = (client: BasedClient) => {
  if (client.drainInProgress) {
    clearTimeout(client.drainTimeout)
    client.drainInProgress = false
  }
}

export const addToFunctionQueue = (
  client: BasedClient,
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

  // TODO: When node env is not "production" | or when dev
  const s = Error().stack.split(/BasedClient\.function.+:\d\d\)/)[1]

  client.functionResponseListeners.set(id, [resolve, reject, s])
  client.functionQueue.push([id, name, payload])

  drainQueue(client)
}

export const addObsCloseToQueue = (
  client: BasedClient,
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
  client: BasedClient,
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
  client: BasedClient,
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

export const sendAuth = (client: BasedClient, authState: AuthState) => {
  if (deepEqual(authState, client.authState)) {
    console.warn('[Based] Trying to send the same authState twice')
    return client.authRequest.inProgress
      ? client.authRequest.promise
      : new Promise((resolve) => resolve(false))
  }
  if (client.authRequest.inProgress) {
    // TODO:
    // fix this situation?
    // add endpoint to refresh token on http
    console.error(
      '[Based] Authentication still in progress - will not work (will be added later)'
    )
    // TODO: need to set id on AUTH (req id)
    return client.authRequest.promise
  }

  client.authState = authState

  if (client.connected) {
    client.connection.ws.send(encodeAuthMessage(authState))
  }

  client.authRequest.promise = new Promise<AuthState>((resolve, reject) => {
    client.authRequest.inProgress = true
    client.authRequest.resolve = resolve
    client.authRequest.reject = reject
    // Gets send in the upgrade header of the websocket
  }).finally(() => {
    client.authRequest.resolve = null
    client.authRequest.reject = null
    client.authRequest.inProgress = false
  })
  return client.authRequest.promise
}