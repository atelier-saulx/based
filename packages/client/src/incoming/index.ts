import { BasedClient } from '../index.js'
import { inflateSync } from 'fflate'
import { applyPatch } from '@saulx/diff'
import { deepEqual, readUint32, readUint24, readUint64 } from '@saulx/utils'
import { updateAuthState } from '../authState/updateAuthState.js'
import { setStorage } from '../persistentStorage/index.js'
import { CACHE_PREFIX } from '../persistentStorage/constants.js'
import { parseArrayBuffer, decodeHeader, requestFullData } from './protocol.js'
import { encodeSubscribeChannelMessage } from '../outgoing/protocol.js'
import { getTargetInfo } from '../getTargetInfo.js'
import { CacheValue } from '../types/index.js'
import { freeCacheMemory } from '../cache.js'
import { convertDataToBasedError } from '@based/errors/client'
import { forceReload } from './forceReload.js'
import { parseIncomingData } from './parseIncomingData.js'

const deflate = (
  start: number,
  end: number,
  isDeflate: boolean,
  buffer: Uint8Array,
): any => {
  return isDeflate
    ? inflateSync(buffer.slice(start, end))
    : buffer.slice(start, end)
}

export const incoming = async (client: BasedClient, data: any) => {
  if (client.isDestroyed) {
    return
  }

  try {
    const d = data.data
    const buffer = await parseArrayBuffer(d)

    const { type, len, isDeflate } = decodeHeader(readUint32(buffer, 0))

    // reader for batched replies
    // ------- Function
    if (type === 0) {
      // | 4 header | 3 id | * payload |
      const id = readUint24(buffer, 4)
      const start = 7
      const end = len + 4
      let payload: any

      // if not empty response, parse it
      if (len !== 3) {
        payload = parseIncomingData(deflate(start, end, isDeflate, buffer))
      }

      if (client.functionResponseListeners.has(id)) {
        client.functionResponseListeners.get(id)[0](payload)
        client.functionResponseListeners.delete(id)
      }
    }

    // ------- Get checksum is up to date
    else if (type === 3) {
      // | 4 header | 8 id |
      const id = readUint64(buffer, 4)
      if (client.getState.has(id) && client.cache.has(id)) {
        const get = client.getState.get(id)
        for (const [resolve] of get) {
          resolve(client.cache.get(id).v)
        }
        client.getState.delete(id)
      }
    }

    // ------- Subscription diff data
    else if (type === 2) {
      // | 4 header | 8 id | 8 checksum | 8 previousChecksum | * diff |
      const id = readUint64(buffer, 4)

      const cachedData = client.cache.get(id)

      if (!cachedData) {
        requestFullData(client, id)
        return
      }

      const checksum = readUint64(buffer, 12)
      const previousChecksum = readUint64(buffer, 20)

      if (cachedData.c !== previousChecksum) {
        requestFullData(client, id)
        return
      }

      const start = 28
      const end = len + 4
      let diff: any
      let size = 0

      if (len !== 24) {
        const inflatedBuffer = isDeflate
          ? inflateSync(buffer.slice(start, end))
          : buffer.slice(start, end)
        size = inflatedBuffer.byteLength

        diff = parseIncomingData(inflatedBuffer)
      }

      try {
        // bit weird...
        if (size > cachedData.s) {
          client.cacheSize -= cachedData.s
          client.cacheSize += size
          cachedData.s = size
        }
        cachedData.v = applyPatch(cachedData.v, diff)
        cachedData.c = checksum
      } catch (err) {
        requestFullData(client, id)
        return
      }

      if (client.observeState.has(id)) {
        const observable = client.observeState.get(id)

        if (observable.persistent) {
          cachedData.p = true
          setStorage(client, CACHE_PREFIX + id, cachedData)
        }

        for (const [, handlers] of observable.subscribers) {
          handlers.onData(cachedData.v, checksum)
        }
      }

      if (client.getState.has(id)) {
        const get = client.getState.get(id)
        for (const [resolve] of get) {
          resolve(cachedData.v)
        }
        client.getState.delete(id)
      }
    }

    // ------- Subscription data
    else if (type === 1) {
      // | 4 header | 8 id | 8 checksum | * payload |
      const id = readUint64(buffer, 4)
      const checksum = readUint64(buffer, 12)

      const start = 20
      const end = len + 4
      let payload: any

      let size = 0

      // If not empty response, parse it
      if (len !== 16) {
        const inflatedBuffer = isDeflate
          ? inflateSync(buffer.slice(start, end))
          : buffer.slice(start, end)
        size = inflatedBuffer.byteLength
        payload = parseIncomingData(inflatedBuffer)
      }

      const cached = client.cache.get(id)

      const noChange = cached?.c === checksum

      if (!noChange) {
        client.cacheSize += size

        if (cached && cached.s) {
          client.cacheSize -= cached.s
        }

        if (client.cacheSize > client.maxCacheSize) {
          freeCacheMemory(client)
        }

        const cacheData: CacheValue = {
          v: payload,
          c: checksum,
          s: size,
        }

        client.cache.set(id, cacheData)
        if (client.observeState.has(id)) {
          const observable = client.observeState.get(id)
          if (observable.persistent) {
            cacheData.p = true
            setStorage(client, CACHE_PREFIX + id, cacheData)
          }
          for (const [, handlers] of observable.subscribers) {
            handlers.onData(payload, checksum)
          }
        }
      }

      if (client.getState.has(id)) {
        const get = client.getState.get(id)
        for (const [resolve] of get) {
          resolve(payload)
        }
        client.getState.delete(id)
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
        payload = parseIncomingData(deflate(start, end, isDeflate, buffer))
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
        client.authRequest?.resolve?.(client.authState)
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
        payload = parseIncomingData(deflate(start, end, isDeflate, buffer))
      }

      if (payload.streamRequestId) {
        if (
          client.streamFunctionResponseListeners.has(payload.streamRequestId)
        ) {
          const [, reject] = client.streamFunctionResponseListeners.get(
            payload.streamRequestId,
          )
          reject(convertDataToBasedError(payload))
          client.streamFunctionResponseListeners.delete(payload.streamRequestId)
        }
      }

      if (payload.requestId) {
        if (client.functionResponseListeners.has(payload.requestId)) {
          const [, reject, stack] = client.functionResponseListeners.get(
            payload.requestId,
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
              console.error(
                getTargetInfo(client, payload.channelId, 'channel'),
                error,
              )
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
              console.error(
                getTargetInfo(client, payload.observableId, 'sub'),
                error,
              )
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
    } // ------- Re-Publish send channel name + payload
    else if (type === 6) {
      // | 4 header | 8 id | * payload |
      // get id add last send on the state
      const id = readUint64(buffer, 4)
      const channel = client.channelState.get(id)
      if (id) {
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
        }
        client.connection.ws.send(buffer)
      }
    } // ----------- SubType 7
    else if (type === 7) {
      // | 4 header | 1 subType |
      const subType = buffer[4]

      // channel
      if (subType === 0) {
        // | 4 header | 1 subType | 8 id | * payload |
        const id = readUint64(buffer, 5)

        const start = 13
        const end = len + 5
        let payload: any

        // if not empty response, parse it
        if (len !== 9) {
          payload = parseIncomingData(deflate(start, end, isDeflate, buffer))
        }

        if (client.channelState.has(id)) {
          const observable = client.channelState.get(id)
          for (const [, handlers] of observable.subscribers) {
            handlers.onMessage(payload)
          }
        }
      } else if (subType === 1) {
        // | 4 header | 1 subType | 3 id | * payload |
        const id = readUint24(buffer, 5)
        const start = 8
        const end = len + 4
        let payload: any
        // if not empty response, parse it
        if (len !== 4) {
          payload = parseIncomingData(deflate(start, end, isDeflate, buffer))
        }
        if (client.streamFunctionResponseListeners.has(id)) {
          client.streamFunctionResponseListeners.get(id)[0](payload)
          client.streamFunctionResponseListeners.delete(id)
        }
      } else if (subType === 2) {
        // | 4 header | 1 subType | 3 id | 1 seqId | 1 code | maxChunkSize
        const id = readUint24(buffer, 5)
        const seqId = buffer[8]
        const code = buffer[9]

        let maxChunkSize = 0

        if (len > 10 - 4) {
          // derp bit weird
          maxChunkSize = readUint24(buffer, 10)
        }

        // if len is smaller its an error OR use 0 as error (1 - 255)
        if (client.streamFunctionResponseListeners.has(id)) {
          client.streamFunctionResponseListeners.get(id)[2](
            seqId,
            code,
            maxChunkSize,
          )
        }
      } else if (subType === 3) {
        // | 4 header | 1 subType | 1 type | 1 seqId
        forceReload(client, buffer[5], buffer[6])
      }
    }
    // ---------------------------------
  } catch (err) {
    // just code can load error codes as well
    // 981 - cannot parse data
    console.error(981, err)
  }
}
