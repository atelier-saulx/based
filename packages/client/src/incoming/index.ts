import { BasedClient } from '..'
import fflate from 'fflate'
import { applyPatch } from '@saulx/diff'
import { addGetToQueue } from '../outgoing'
import { convertDataToBasedError } from '../types/error'
import { deepEqual } from '@saulx/utils'
import { updateAuthState } from '../authState/updateAuthState'
import { setStorage } from '../localStorage'

const getName = (client: BasedClient, id: number): string => {
  const sub = client.observeState.get(id)
  return sub?.name
}

export const decodeHeader = (
  nr: number
): { type: number; isDeflate: boolean; len: number } => {
  // 4 bytes
  // type (3 bits)
  //   0 = functionData
  //   1 = subscriptionData
  //   2 = subscriptionDiffData
  //   3 = get
  //   4 = authData
  //   5 = errorData
  //   6 = channelMessage
  //   7 = requesChannelName
  // isDeflate (1 bit)
  // len (28 bits)
  const len = nr >> 4
  const meta = nr & 15
  const type = meta >> 1
  const isDeflate = meta & 1
  return {
    type,
    isDeflate: isDeflate === 1,
    len,
  }
}

export const readUint8 = (
  buff: Uint8Array,
  start: number,
  len: number
): number => {
  let n = 0
  const s = len - 1 + start
  for (let i = s; i >= start; i--) {
    n = n * 256 + buff[i]
  }
  return n
}

const parseArrayBuffer = async (d: any): Promise<Uint8Array> => {
  if (typeof window === 'undefined') {
    if (d instanceof Buffer) {
      return new Uint8Array(d)
    }
  } else {
    if (d instanceof Blob) {
      const buffer = await d.arrayBuffer()
      return new Uint8Array(buffer)
    }
  }
  throw new Error('Recieved incorrect data')
}

const requestFullData = (client: BasedClient, id: number) => {
  const sub = client.observeState.get(id)
  if (!sub) {
    console.warn(`Cannot find query function name for id from diff [id]`)
    return
  }
  addGetToQueue(client, sub.name, id, sub.payload)
}

export const incoming = async (
  client: BasedClient,
  data: any /* TODO: type */
) => {
  const debug = client.listeners.debug

  try {
    const d = data.data

    const buffer = await parseArrayBuffer(d)

    const { type, len, isDeflate } = decodeHeader(readUint8(buffer, 0, 4))
    // reader for batched replies

    // ------- Function
    if (type === 0) {
      // | 4 header | 3 id | * payload |
      const id = readUint8(buffer, 4, 3)
      const start = 7
      const end = len + 4
      let payload: any

      // if not empty response, parse it
      if (len !== 3) {
        payload = JSON.parse(
          new TextDecoder().decode(
            isDeflate
              ? fflate.inflateSync(buffer.slice(start, end))
              : buffer.slice(start, end)
          )
        )
      }

      if (client.functionResponseListeners.has(id)) {
        client.functionResponseListeners.get(id)[0](payload)
        client.functionResponseListeners.delete(id)
      }

      if (debug) {
        client.emit('debug', {
          type: 'function',
          direction: 'incoming',
          payload,
          id,
        })
      }
    }

    // ------- Get checksum is up to date
    else if (type === 3) {
      // | 4 header | 8 id |
      const id = readUint8(buffer, 4, 8)
      if (client.getState.has(id) && client.cache.has(id)) {
        const get = client.getState.get(id)
        for (const [resolve] of get) {
          resolve(client.cache.get(id).value)
        }
        client.getState.delete(id)
      }

      if (debug) {
        client.emit('debug', {
          type: 'get',
          direction: 'incoming',
          id,
        })
      }
    }

    // ------- Subscription diff data
    else if (type === 2) {
      // | 4 header | 8 id | 8 checksum | 8 previousChecksum | * diff |
      const id = readUint8(buffer, 4, 8)

      const cachedData = client.cache.get(id)

      if (!cachedData) {
        requestFullData(client, id)
        return
      }

      const checksum = readUint8(buffer, 12, 8)
      const previousChecksum = readUint8(buffer, 20, 8)

      if (cachedData.checksum !== previousChecksum) {
        requestFullData(client, id)
        return
      }

      const start = 28
      const end = len + 4
      let diff: any

      // if not empty response, parse it
      if (len !== 24) {
        diff = JSON.parse(
          new TextDecoder().decode(
            isDeflate
              ? fflate.inflateSync(buffer.slice(start, end))
              : buffer.slice(start, end)
          )
        )
      }

      try {
        cachedData.value = applyPatch(cachedData.value, diff)
        cachedData.checksum = checksum
      } catch (err) {
        console.warn('Cannot apply corrupt patch for ' + getName(client, id))
        requestFullData(client, id)
        return
      }

      if (client.observeState.has(id)) {
        const observable = client.observeState.get(id)

        if (observable.persistent) {
          setStorage(client, '@based-cache-' + id, cachedData)
        }

        for (const [, handlers] of observable.subscribers) {
          handlers.onData(cachedData.value, checksum)
        }
      }

      if (client.getState.has(id)) {
        const get = client.getState.get(id)
        for (const [resolve] of get) {
          resolve(cachedData.value)
        }
        client.getState.delete(id)
      }

      if (debug) {
        client.emit('debug', {
          type: 'subscriptionDiff',
          direction: 'incoming',
          id,
          payload: diff,
        })
      }
    }

    // ------- Subscription data
    else if (type === 1) {
      // | 4 header | 8 id | 8 checksum | * payload |
      const id = readUint8(buffer, 4, 8)
      const checksum = readUint8(buffer, 12, 8)

      // console.info('Incoming sub data', getName(client, id), id, checksum)
      const start = 20
      const end = len + 4
      let payload: any

      // if not empty response, parse it
      if (len !== 16) {
        payload = JSON.parse(
          new TextDecoder().decode(
            isDeflate
              ? fflate.inflateSync(buffer.slice(start, end))
              : buffer.slice(start, end)
          )
        )
      }

      // handle max size etc / localstorage etc

      client.cache.set(id, {
        value: payload,
        checksum,
      })

      let found = false

      if (client.observeState.has(id)) {
        const observable = client.observeState.get(id)

        if (observable.persistent) {
          setStorage(client, '@based-cache-' + id, { value: payload, checksum })
        }

        for (const [, handlers] of observable.subscribers) {
          handlers.onData(payload, checksum)
        }
        found = true
      }

      if (client.getState.has(id)) {
        const get = client.getState.get(id)
        for (const [resolve] of get) {
          resolve(payload)
        }
        client.getState.delete(id)
        found = true
      }

      if (debug) {
        client.emit('debug', {
          type: 'subscribe',
          direction: 'incoming',
          id,
          payload,
          ...(!found ? { msg: 'Cannot find subscription handler' } : undefined),
        })
      }
    }

    // ------- AuthState
    else if (type === 4) {
      // | 4 header | * payload |
      const start = 4
      const end = len + 4
      let payload: any

      // if not empty response, parse it
      if (len !== 3) {
        payload = JSON.parse(
          new TextDecoder().decode(
            isDeflate
              ? fflate.inflateSync(buffer.slice(start, end))
              : buffer.slice(start, end)
          )
        )
      }

      if (payload === true) {
        client.authRequest.resolve?.(client.authState)
      } else if ('error' in payload) {
        // make a function updateAuthState
        updateAuthState(client, payload)
        client.emit('authstate-change', client.authState)
        client.authRequest.reject?.(new Error(payload.error))
      } else {
        if (!deepEqual(client.authState, payload)) {
          updateAuthState(client, payload)
          client.emit('authstate-change', client.authState)
        } else {
          updateAuthState(client, payload)
        }
        client.authRequest.resolve?.(client.authState)
      }

      if (debug) {
        client.emit('debug', {
          type: 'auth',
          direction: 'incoming',
          payload,
        })
      }
    }

    // ------- Errors
    else if (type === 5) {
      // | 4 header | * payload |
      const start = 4
      const end = len + 4
      let payload: any

      // if not empty response, parse it
      if (len !== 3) {
        payload = JSON.parse(
          new TextDecoder().decode(
            isDeflate
              ? fflate.inflateSync(buffer.slice(start, end))
              : buffer.slice(start, end)
          )
        )
      }

      if (payload.requestId) {
        if (client.functionResponseListeners.has(payload.requestId)) {
          const [, reject, stack] = client.functionResponseListeners.get(
            payload.requestId
          )
          reject(convertDataToBasedError(payload, stack))
          client.functionResponseListeners.delete(payload.requestId)
        }
      }

      if (payload.observableId) {
        client.cache.delete(payload.observableId)

        if (client.observeState.has(payload.observableId)) {
          const error = convertDataToBasedError(payload)
          const observable = client.observeState.get(payload.observableId)
          for (const [, handlers] of observable.subscribers) {
            if (handlers.onError) {
              handlers.onError(error)
            } else {
              console.error(error)
            }
          }
        }
        if (client.getState.has(payload.observableId)) {
          const error = convertDataToBasedError(payload)
          const get = client.getState.get(payload.observableId)
          for (const [, reject] of get) {
            // also add stack
            reject(error)
          }
          client.getState.delete(payload.observableId)
        }
      }

      if (debug) {
        client.emit('debug', {
          type: 'error',
          direction: 'incoming',
          payload,
        })
      }
      // else emit ERROR maybe?
    } // ------- Channel data
    else if (type === 6) {
      // | 4 header | 8 id | * payload |
      const id = readUint8(buffer, 4, 8)

      const start = 12
      const end = len + 4
      let payload: any

      // if not empty response, parse it
      if (len !== 8) {
        const r = new TextDecoder().decode(
          isDeflate
            ? fflate.inflateSync(buffer.slice(start, end))
            : buffer.slice(start, end)
        )
        try {
          payload = JSON.parse(r)
        } catch (err) {}
        payload = r
      }

      let found = false

      if (client.channelState.has(id)) {
        const observable = client.channelState.get(id)
        for (const [, handlers] of observable.subscribers) {
          handlers(payload)
        }
        found = true
      }

      if (debug) {
        client.emit('debug', {
          type: 'channelMessage',
          direction: 'incoming',
          payload,
          id,
          ...(!found ? { msg: 'Cannot find channel handler' } : undefined),
        })
      }
    }
    // ---------------------------------
  } catch (err) {
    console.error('Error parsing incoming data', err)
  }
}
