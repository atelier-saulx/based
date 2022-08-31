import { BasedCoreClient } from '../'
import { AuthState, GenericObject } from '../types'
import fflate from 'fflate'

const encoder = new TextEncoder()

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

const storeUint8 = (
  buff: Uint8Array,
  n: number,
  start: number,
  len: number
) => {
  for (let index = start; index < start + len; index++) {
    const byte = n & 0xff
    buff[index] = byte
    n = (n - byte) / 256
  }
}

const encodeHeader = (
  type: number,
  isDeflate: boolean,
  len: number
): number => {
  // 4 bytes
  // type (3 bits)
  //   0 = function
  //   1 = subscribe
  //   2 = unsubscribe
  //   3 = get from observable
  //   4 = auth
  // isDeflate (1 bit)
  // len (28 bits)
  const encodedMeta = (type << 1) + (isDeflate ? 1 : 0)
  const nr = (len << 4) + encodedMeta
  return nr
}

const encodePayload = (payload: any): [boolean, Uint8Array] | [boolean] => {
  let p: Uint8Array
  let isDeflate = false
  if (payload !== undefined) {
    p = encoder.encode(JSON.stringify(payload))
    if (p.length > 150) {
      p = fflate.deflateSync(p)
      isDeflate = true
    }
    return [isDeflate, p]
  }
  return [false]
}

export const drainQueue = (client: BasedCoreClient) => {
  if (
    client.connected &&
    !client.drainInProgress &&
    (client.functionQueue.length ||
      client.observeQueue.size ||
      client.authQueue.length)
  ) {
    client.drainInProgress = true
    const drainOutgoing = () => {
      client.drainInProgress = false

      if (
        client.functionQueue.length ||
        client.observeQueue.size ||
        client.authQueue.length
      ) {
        const fn = client.functionQueue
        const ob = client.observeQueue
        const au = client.authQueue

        const buffs = []
        let l = 0

        // ------- Function
        for (const f of fn) {
          // | 4 header | 3 id | 1 name length | * name | * payload |
          let len = 7
          const [id, name, payload] = f
          const n = encoder.encode(name)
          len += 1 + n.length
          const [isDeflate, p] = encodePayload(payload)
          if (p) {
            len += p.length
          }
          const header = encodeHeader(0, isDeflate, len)
          const buff = new Uint8Array(4 + 3 + 1)
          storeUint8(buff, header, 0, 4)
          storeUint8(buff, id, 4, 3)
          buff[7] = n.length
          if (p) {
            buffs.push(buff, n, p)
          } else {
            buffs.push(buff, n)
          }
          l += len
        }

        // ------- Observe
        for (const [id, o] of ob) {
          let len = 4
          const [type, name, checksum, payload] = o

          // Type 1 = subscribe
          // | 4 header | 8 id | 8 checksum | 1 name length | * name | * payload |

          // Type 2 = unsubscribe
          // | 4 header | 8 id |

          if (type === 2) {
            const header = encodeHeader(type, false, 12)
            const buff = new Uint8Array(4 + 8)
            storeUint8(buff, header, 0, 4)
            storeUint8(buff, id, 4, 8)
            buffs.push(buff)
            l += 12
          } else {
            const n = encoder.encode(name)
            len += 1 + n.length
            const [isDeflate, p] = encodePayload(payload)
            if (p) {
              len += p.length
            }
            const buffLen = 16
            len += buffLen
            const header = encodeHeader(type, isDeflate, len)
            const buff = new Uint8Array(1 + 4 + buffLen)
            storeUint8(buff, header, 0, 4)
            storeUint8(buff, id, 4, 8)
            storeUint8(buff, checksum, 12, 8)
            buff[20] = n.length
            if (p) {
              buffs.push(buff, n, p)
            } else {
              buffs.push(buff, n)
            }
            l += len
          }
        }

        // ------- Auth
        for (const a of au) {
          // | 4 header | 3 id | * payload |
          let len = 7
          const [id, authState] = a
          const [isDeflate, as] = encodePayload(authState)
          if (as) {
            len += as.length
          }
          const header = encodeHeader(4, isDeflate, len)
          const buff = new Uint8Array(4 + 3)
          storeUint8(buff, header, 0, 4)
          storeUint8(buff, id, 4, 3)
          buff[7] = as.length
          if (as) {
            buffs.push(buff, as)
          } else {
            buffs.push(buff)
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
        client.observeQueue.clear()
        client.authQueue = []

        client.connection.ws.send(n)
        idleTimeout(client)
      }
    }

    client.drainTimeout = setTimeout(drainOutgoing, 0)
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
  client.functionResponseListeners[id] = [resolve, reject]
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

export const addAuthToQueue = (
  client: BasedCoreClient,
  authState: AuthState,
  resolve: (response: any) => void,
  reject: (err: Error) => void
) => {
  client.requestId++
  if (client.requestId > 16777215) {
    client.requestId = 0
  }
  const id = client.requestId
  client.authResponseListeners[id] = [resolve, reject]
  client.authQueue.push([id, authState])

  drainQueue(client)
}

// sub get queue
