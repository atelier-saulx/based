import { BasedClient } from '..'
import fflate from 'fflate'
import { applyPatch } from '@saulx/diff'
import { convertDataToBasedError } from '../types/error'
import { deepEqual } from '@saulx/utils'
import { updateAuthState } from '../authState/updateAuthState'
import { setStorage } from '../localStorage'
import {
  debugDiff,
  debugFunction,
  debugGet,
  debugSubscribe,
  debugAuth,
  debugError,
  debugChannel,
  debugChannelReqId,
} from './debug'
import {
  parseArrayBuffer,
  decodeHeader,
  readUint8,
  requestFullData,
} from './protocol'
import { encodeSubscribeChannelMessage } from '../outgoing/protocol'

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
        debugFunction(client, payload, id)
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
        debugGet(client, id)
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
        if (debug) {
          debugDiff(client, diff, id, checksum, true)
        }
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
        debugDiff(client, diff, checksum, id)
      }
    }

    // ------- Subscription data
    else if (type === 1) {
      // | 4 header | 8 id | 8 checksum | * payload |
      const id = readUint8(buffer, 4, 8)
      const checksum = readUint8(buffer, 12, 8)

      const start = 20
      const end = len + 4
      let payload: any

      // If not empty response, parse it
      if (len !== 16) {
        payload = JSON.parse(
          new TextDecoder().decode(
            isDeflate
              ? fflate.inflateSync(buffer.slice(start, end))
              : buffer.slice(start, end)
          )
        )
      }

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
        debugSubscribe(client, id, payload, checksum, found)
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
        debugAuth(client, payload)
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

      if (payload.channelId) {
        if (client.channelState.has(payload.channelId)) {
          const error = convertDataToBasedError(payload)
          const channel = client.channelState.get(payload.channelId)
          for (const [, handlers] of channel.subscribers) {
            if (handlers.onError) {
              handlers.onError(error)
            } else {
              console.error(error)
            }
          }
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
        debugError(client, payload)
      }
      // else emit ERROR maybe?
    } // ------- Re-Publish send channel name + payload
    else if (type === 6) {
      // | 4 header | 8 id | * payload |
      // get id add last send on the state
      const id = readUint8(buffer, 4, 8)
      const channel = client.channelState.get(id)
      if (!id) {
        if (debug) {
          debugChannelReqId(client, id, 'not-found')
        }
      } else {
        if (!channel.inTransit) {
          channel.inTransit = true
          const { buffers, len } = encodeSubscribeChannelMessage(id, [
            6,
            channel.name,
            channel.payload,
          ])
          const n = new Uint8Array(len)
          let c = 0
          for (const b of buffers) {
            n.set(b, c)
            c += b.length
          }
          client.connection.ws.send(n)
          if (channel.removeTimer !== -1 && channel.removeTimer < 2) {
            channel.removeTimer += 1
          }
          setTimeout(() => {
            const channel = client.channelState.get(id)
            if (channel) {
              channel.inTransit = false
            }
          }, 5e3)
          if (debug) {
            debugChannelReqId(client, id, 'register')
          }
        }

        client.connection.ws.send(buffer)
        if (debug) {
          debugChannelReqId(client, id, 'publish', buffer, isDeflate)
        }
      }
    } // ----------- Channel message
    else if (type === 7) {
      // | 4 header | 1 subType |
      const subType = readUint8(buffer, 4, 1)

      if (subType === 0) {
        // | 4 header | 1 subType | 8 id | * payload |
        const id = readUint8(buffer, 5, 8)

        const start = 13
        const end = len + 5
        let payload: any

        // if not empty response, parse it
        if (len !== 9) {
          const r = new TextDecoder().decode(
            isDeflate
              ? fflate.inflateSync(buffer.slice(start, end))
              : buffer.slice(start, end)
          )
          try {
            payload = JSON.parse(r)
          } catch (err) {
            payload = r
          }
        }

        let found = false

        if (client.channelState.has(id)) {
          const observable = client.channelState.get(id)
          for (const [, handlers] of observable.subscribers) {
            handlers.onMessage(payload)
          }
          found = true
        }

        if (debug) {
          debugChannel(client, id, payload, found)
        }
      }
    }
    // ---------------------------------
  } catch (err) {
    console.error('Error parsing incoming data', err)
  }
}
