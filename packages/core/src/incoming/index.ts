import { BasedCoreClient } from '..'
import fflate from 'fflate'
import { applyPatch } from '@saulx/diff'
import { addGetToQueue } from '../outgoing'
import { convertDataToBasedError } from '../types/error'

const getName = (client: BasedCoreClient, id: number): string => {
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

const requestFullData = (client: BasedCoreClient, id: number) => {
  const sub = client.observeState.get(id)
  if (!sub) {
    console.error('Cannot find name for id from diff', id)
    return
  }
  // console.info(
  //   'GET NEW DATA',
  //   id,
  //   'HAS',
  //   [...client.cache.keys()].map((v) => {
  //     return `${getName(client, v)} : ${v} `
  //   })
  // )
  // and prob need to add an extra arg (type 4 msg) to enfore sending the data back
  addGetToQueue(client, sub.name, id, sub.payload)
}

export const incoming = async (
  client: BasedCoreClient,
  data: any /* TODO: type */
) => {
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
    }

    // ------- Subscription diff data
    else if (type === 2) {
      // | 4 header | 8 id | 8 checksum | 8 previousChecksum | * diff |
      const id = readUint8(buffer, 4, 8)

      const cachedData = client.cache.get(id)

      // console.info('Incoming diff data', getName(client, id), id)

      if (!cachedData) {
        // console.info('DIFF => NO CACHE')

        requestFullData(client, id)
        return
      }

      const checksum = readUint8(buffer, 12, 8)
      const previousChecksum = readUint8(buffer, 20, 8)

      if (cachedData.checksum !== previousChecksum) {
        // console.info('DIFF => DIFF CHECKSUM')
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
        applyPatch(cachedData.value, diff)
        cachedData.checksum = checksum
      } catch (err) {
        console.warn('Cannot apply corrupt patch for ' + getName(client, id))
        requestFullData(client, id)
        return
      }

      if (client.observeState.has(id)) {
        const observable = client.observeState.get(id)
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

      if (!found) {
        console.warn('Cannot find sub for incoming id', id)
      }
    }

    // ------- Auth
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
        client.authState = client.authRequest.authState
      } else {
        client.authState = payload
      }
      if (client.authRequest.resolve) client.authRequest.resolve(payload)
      client.emit('auth', client.authState)
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

      const error = convertDataToBasedError(payload)
      if (payload.requestId) {
        if (client.functionResponseListeners.has(payload.requestId)) {
          client.functionResponseListeners.get(payload.requestId)[1](error)
          client.functionResponseListeners.delete(payload.requestId)
        }
      }
      if (payload.observableId) {
        client.cache.delete(payload.observableId)

        if (client.observeState.has(payload.observableId)) {
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
          const get = client.getState.get(payload.observableId)
          for (const [, reject] of get) {
            reject(error)
          }
          client.getState.delete(payload.observableId)
        }
      }
    }
    // ---------------------------------
  } catch (err) {
    console.error('Error parsing incoming data', err)
  }
}
