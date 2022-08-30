import { BasedCoreClient } from '..'
import fflate from 'fflate'

export const decodeHeader = (
  nr: number
): { type: number; isDeflate: boolean; len: number } => {
  // 4 bytes
  // type (3 bits)
  //   0 = functionData
  //   1 = subscriptionData
  //   2 = subscriptionDiffData
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

export const incoming = async (client: BasedCoreClient, data) => {
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
      if (len - 3 !== 0) {
        payload = JSON.parse(
          new TextDecoder().decode(
            isDeflate
              ? fflate.inflateSync(buffer.slice(start, end))
              : buffer.slice(start, end)
          )
        )
      }

      if (client.functionResponseListeners[id]) {
        client.functionResponseListeners[id][0](payload)
        delete client.functionResponseListeners[id]
      }
    }
    // ---------------------------------

    // ------- Subscription data
    if (type === 1) {
      // | 4 header | 8 id | 8 checksum | * payload |

      console.info('Sub data!')
      // handle data!
    }
    // ---------------------------------
  } catch (err) {
    console.error('Error parsing incoming data', err)
  }
  // try {
  //   const x = JSON.parse(data.data)
  //   if (x.id) {
  //     if (client.functionResponseListeners[x.id]) {
  //       client.functionResponseListeners[x.id][0](x.msg)
  //       delete client.functionResponseListeners[x.id]
  //     }
  //   }
  // } catch (err) {
  //   console.error('cannot parse dat json', err)
  // }
}
