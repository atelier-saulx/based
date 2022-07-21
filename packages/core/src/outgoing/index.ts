import { BasedCoreClient } from '../'
import { GenericObject } from '../types'
import fflate from 'fflate'

const encoder = new TextEncoder() // always utf-8

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
  // type (3 bits) (8 options) 0=function, 1=get sub, 2=get sub allways return
  // isDeflate (1 bit)
  // len (28 bits)
  const encodedMeta = (type << 1) + (isDeflate ? 1 : 0)
  const nr = (len << 4) + encodedMeta
  return nr
}

export const drainQueue = (client: BasedCoreClient) => {
  if (
    client.connected &&
    !client.drainInProgress &&
    (client.functionQueue.length || client.observeQueue.length)
  ) {
    client.drainInProgress = true
    client.drainTimeout = setTimeout(() => {
      client.drainInProgress = false
      if (client.functionQueue.length || client.observeQueue.length) {
        const fn = client.functionQueue
        // const ob = client.observeQueue
        client.functionQueue = []
        client.observeQueue = []
        const buffs = []
        let l = 0
        // bit types
        // 000 => fn
        // 001 => subNoReply
        // 002 => subReply
        // 1 bit for isGzip or not
        // HEADER 4 bytes (4 bits for type + isGzip or not) 28 bits for length of the payload
        for (const f of fn) {
          // id 3 | name len Encode 1 + var | payload
          let len = 3
          let isDeflate = false
          const [id, name, payload] = f
          const n = encoder.encode(name)
          len += n.length + 1
          let p: Uint8Array
          if (payload) {
            p = encoder.encode(JSON.stringify(payload))
            if (p.length > 150) {
              // use gzip as well here if node
              p = fflate.deflateSync(p)
              isDeflate = true
            }
            len += p.length
          }

          const header = encodeHeader(0, isDeflate, len)
          len += 4 // header size
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
        const n = new Uint8Array(l)
        let c = 0
        for (const b of buffs) {
          n.set(b, c)
          c += b.length
        }
        client.connection.ws.send(n)
        idleTimeout(client)
      }
    }, 0)
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

  //   let x = encoder.encode(name)
  //   console.info(x)
  drainQueue(client)
}

// export const addToObserveQueue = (client: BasedCoreClient) => {}
