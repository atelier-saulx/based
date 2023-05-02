import { BasedClient } from '..'
import { AuthState, GenericObject } from '../types'
import { updateAuthState } from '../authState/updateAuthState'
import {
  encodeAuthMessage,
  encodeFunctionMessage,
  encodeGetObserveMessage,
  encodeObserveMessage,
  encodePublishMessage,
  encodeSubscribeChannelMessage,
} from './protocol'
import { deepEqual } from '@saulx/utils'
import {
  debugChannel,
  debugFunction,
  debugGet,
  debugObserve,
  debugPublish,
} from './debug'

const PING = new Uint8Array(0)

export const idleTimeout = (client: BasedClient) => {
  const updateTime = 60 * 1e3
  clearTimeout(client.idlePing)
  client.idlePing = setTimeout(() => {
    if (
      client.connection &&
      client.connected &&
      !client.connection.disconnected
    ) {
      client.connection.ws.send(PING)
    }
  }, updateTime)
}

export const drainQueue = (client: BasedClient) => {
  if (
    client.connected &&
    !client.drainInProgress &&
    (client.functionQueue.length ||
      client.observeQueue.size ||
      client.getObserveQueue.size ||
      client.channelQueue.size ||
      client.publishQueue.length)
  ) {
    client.drainInProgress = true
    const drainOutgoing = () => {
      client.drainInProgress = false

      if (!client.connected) {
        return
      }

      const debug = client.listeners.debug

      if (
        client.functionQueue.length ||
        client.observeQueue.size ||
        client.getObserveQueue.size ||
        client.channelQueue.size ||
        client.publishQueue.length
      ) {
        const channel = client.channelQueue
        const publish = client.publishQueue
        const fn = client.functionQueue
        const obs = client.observeQueue
        const get = client.getObserveQueue

        const buffs = []
        let l = 0

        // ------- Channel
        for (const [id, o] of channel) {
          const { buffers, len } = encodeSubscribeChannelMessage(id, o)
          buffs.push(...buffers)
          l += len
          if (debug) {
            debugChannel(client, id, o)
          }
        }

        // ------- GetObserve
        for (const [id, o] of get) {
          const { buffers, len } = encodeGetObserveMessage(id, o)
          buffs.push(...buffers)
          l += len
          if (debug) {
            debugGet(client, id, o)
          }
        }

        // ------- Observe
        for (const [id, o] of obs) {
          const { buffers, len } = encodeObserveMessage(id, o)
          buffs.push(...buffers)
          l += len

          if (debug) {
            debugObserve(client, id, o)
          }
        }

        // ------- Function
        for (const f of fn) {
          const { buffers, len } = encodeFunctionMessage(f)
          buffs.push(...buffers)
          l += len

          if (debug) {
            debugFunction(client, f)
          }
        }

        // ------- Publish
        for (const f of publish) {
          const { buffers, len } = encodePublishMessage(f)
          buffs.push(...buffers)

          if (debug) {
            debugPublish(client, f)
          }

          l += len
        }

        const n = new Uint8Array(l)
        let c = 0
        for (const b of buffs) {
          n.set(b, c)
          c += b.length
        }

        client.functionQueue = []
        client.publishQueue = []
        client.observeQueue.clear()
        client.getObserveQueue.clear()
        client.channelQueue.clear()

        client.connection.ws.send(n)
        idleTimeout(client)
      }
    }

    client.drainTimeout = setTimeout(drainOutgoing, 0)
  }
}

export const stopDrainQueue = (client: BasedClient) => {
  if (client.drainInProgress) {
    clearTimeout(client.drainTimeout)
    client.drainInProgress = false
  }
}

// ------------ Function ---------------
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

// ------------ Channel ---------------
export const addChannelCloseToQueue = (client: BasedClient, id: number) => {
  const type = client.channelQueue.get(id)?.[0]
  if (type === 7) {
    return
  }
  client.channelQueue.set(id, [7])
  drainQueue(client)
}

export const addChannelSubscribeToQueue = (
  client: BasedClient,
  name: string,
  id: number,
  payload: GenericObject
) => {
  const type = client.channelQueue.get(id)?.[0]
  if (type === 5) {
    return
  }
  client.channelQueue.set(id, [5, name, payload])
  drainQueue(client)
}

export const addChannelPublishIdentifier = (
  client: BasedClient,
  name: string,
  id: number,
  payload: GenericObject
) => {
  const type = client.channelQueue.get(id)?.[0]
  if (type === 5 || type === 6) {
    return
  }
  if (type === 7) {
    console.warn('Case not handled yet... ubsub and req for info for channel')
  }
  client.channelQueue.set(id, [6, name, payload])
  drainQueue(client)
}

export const addToPublishQueue = (
  client: BasedClient,
  id: number,
  payload: any
) => {
  if (client.publishQueue.length > 150) {
    client.publishQueue.shift()
  }
  client.publishQueue.push([id, payload])
  drainQueue(client)
}

// ------------ Observable ---------------
export const addObsCloseToQueue = (client: BasedClient, id: number) => {
  const type = client.observeQueue.get(id)?.[0]
  if (type === 2) {
    return
  }
  client.observeQueue.set(id, [2])
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

// ------------ Auth ---------------
export const sendAuth = async (
  client: BasedClient,
  authState: AuthState
): Promise<AuthState> => {
  if (deepEqual(authState, client.authState)) {
    console.warn(
      '[Based] Trying to send the same authState twice',
      client.authState
    )
    return client.authRequest.inProgress
      ? client.authRequest.promise
      : new Promise((resolve) => resolve({}))
  }

  if (client.authRequest.inProgress) {
    console.warn(
      '[Based] Authentication still in progress - waiting until done'
    )
    await client.authRequest.promise
  }

  updateAuthState(client, authState)
  client.emit('authstate-change', client.authState)

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
