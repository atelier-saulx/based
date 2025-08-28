import { BasedClient } from '../index.js'
import { AuthState, GenericObject } from '../types/index.js'
import { updateAuthState } from '../authState/updateAuthState.js'
import {
  encodeAuthMessage,
  encodeFunctionMessage,
  encodeGetObserveMessage,
  encodeObserveMessage,
  encodePublishMessage,
  encodeStreamMessage,
  encodeSubscribeChannelMessage,
} from './protocol.js'
import { deepEqual } from '@based/utils'
import connect from '../websocket/index.js'

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

const hasQueue = (client: BasedClient): boolean => {
  return !!(
    client.fQ.length ||
    client.oQ.size ||
    client.gQ.size ||
    client.cQ.size ||
    client.pQ.length ||
    client.sQ.length
  )
}

export const drainQueue = (client: BasedClient) => {
  if (client.connected && !client.drainInProgress && hasQueue(client)) {
    if (client.opts.lazy) {
      // @ts-ignore
      const keepAlive = client.opts?.lazy.keepAlive
      client.connection.keeAliveLastUpdated = keepAlive
    }

    client.drainInProgress = true
    const drainOutgoing = () => {
      client.drainInProgress = false

      if (!client.connected) {
        return
      }

      if (hasQueue(client)) {
        const channel = client.cQ
        const publish = client.pQ
        const fn = client.fQ
        const obs = client.oQ
        const get = client.gQ
        const stream = client.sQ

        const buffs = []
        let l = 0

        // ------- Channel
        for (const [id, o] of channel) {
          const { buffers, len } = encodeSubscribeChannelMessage(id, o)
          buffs.push(...buffers)
          l += len
        }

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

        // ------- Publish
        for (const f of publish) {
          const { buffers, len } = encodePublishMessage(f)
          buffs.push(...buffers)
          l += len
        }

        // ------- Stream
        for (const s of stream) {
          const { buffers, len } = encodeStreamMessage(s)
          buffs.push(...buffers)
          l += len
        }

        // reuse resizable array
        const n = new Uint8Array(l)
        let c = 0
        for (const b of buffs) {
          n.set(b, c)
          c += b.length
        }

        client.fQ = []
        client.pQ = []
        client.sQ = []

        client.oQ.clear()
        client.gQ.clear()
        client.cQ.clear()

        client.connection.ws.send(n)
        idleTimeout(client)
      }
    }

    client.drainTimeout = setTimeout(drainOutgoing, 0)
  } else if (client.opts?.lazy && !client.connection) {
    client.connection = connect(client, client.url)
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
  reject: (err: Error) => void,
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
  client.fQ.push([id, name, payload])

  drainQueue(client)
}

// ------------ Channel ---------------
export const addChannelCloseToQueue = (client: BasedClient, id: number) => {
  const type = client.cQ.get(id)?.[0]
  if (type === 7) {
    return
  }
  client.cQ.set(id, [7])
  drainQueue(client)
}

export const addChannelSubscribeToQueue = (
  client: BasedClient,
  name: string,
  id: number,
  payload: GenericObject,
) => {
  const type = client.cQ.get(id)?.[0]
  if (type === 5) {
    return
  }
  client.cQ.set(id, [5, name, payload])
  drainQueue(client)
}

export const addChannelPublishIdentifier = (
  client: BasedClient,
  name: string,
  id: number,
  payload: GenericObject,
) => {
  const type = client.cQ.get(id)?.[0]
  if (type === 5 || type === 6) {
    return
  }
  // if (type === 7) {
  // unsupported
  // console.warn(10)
  // }
  client.cQ.set(id, [6, name, payload])
  drainQueue(client)
}

export const addToPublishQueue = (
  client: BasedClient,
  id: number,
  payload: any,
) => {
  // TODO: make this configurable at some point
  if (client.pQ.length > client.maxPublishQueue) {
    client.pQ.shift()
  }
  client.pQ.push([id, payload])
  drainQueue(client)
}

// ------------ Observable ---------------
export const addObsCloseToQueue = (client: BasedClient, id: number) => {
  const type = client.oQ.get(id)?.[0]
  if (type === 2) {
    return
  }
  client.oQ.set(id, [2])
  drainQueue(client)
}

export const addObsToQueue = (
  client: BasedClient,
  name: string,
  id: number,
  payload: GenericObject,
  checksum: number = 0,
) => {
  const type = client.oQ.get(id)?.[0]
  if (type === 1) {
    return
  }
  client.oQ.set(id, [1, name, checksum, payload])
  drainQueue(client)
}

export const addGetToQueue = (
  client: BasedClient,
  name: string,
  id: number,
  payload: GenericObject,
  checksum: number = 0,
) => {
  if (client.gQ.has(id)) {
    return
  }
  client.gQ.set(id, [3, name, checksum, payload])
  drainQueue(client)
}

// ------------ Auth ---------------
export const sendAuth = async (
  client: BasedClient,
  authState: AuthState,
): Promise<AuthState> => {
  if (deepEqual(authState, client.authState)) {
    console.warn(
      '[Based] Trying to send the same authState twice',
      client.authState,
    )
    return client.authRequest.inProgress
      ? client.authRequest.promise
      : new Promise((resolve) => resolve({}))
  }

  if (client.authRequest.inProgress) {
    console.warn(
      '[Based] Authentication still in progress - waiting until done',
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

// ------------ Stream ---------------
export const addStreamRegister = (
  client: BasedClient,
  reqId: number,
  contentSize: number,
  name: string,
  mimeType: string,
  extension: string,
  fnName: string,
  payload: any,
) => {
  client.sQ.push([
    1,
    reqId,
    contentSize,
    name,
    mimeType,
    extension,
    fnName,
    payload,
  ])
  drainQueue(client)
}

export const addStreamChunk = (
  client: BasedClient,
  reqId: number,
  seqId: number,
  chunk: Uint8Array,
  deflate: boolean,
) => {
  // lets send the chunks of streams directly
  // also need to keep the amount we push in here to a minimum
  // dc for streams will not resend them
  // client.sQ.push([2, reqId, seqId, chunk])

  // TODO: Add progress listener (send seqId back or multiple)

  if (client.connected) {
    // how to get progress
    const { len, buffers } = encodeStreamMessage([
      2,
      reqId,
      seqId,
      chunk,
      deflate,
    ])
    const n = new Uint8Array(len)
    let c = 0
    for (const b of buffers) {
      n.set(b, c)
      c += b.length
    }
    client.connection.ws.send(n)
    idleTimeout(client)
  } else {
    // console.info('for streams you need to be connected', this can other wiser overflow)
    client.sQ.push([2, reqId, seqId, chunk, deflate])
  }
}
