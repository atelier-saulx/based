import { BasedClient } from '../index.js'
import { addGetToQueue } from '../outgoing/index.js'

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
  //   6 = publish requesChannelName
  //   7.0 = channelMessage
  //   7.1 = stream reply
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

export const parseArrayBuffer = async (d: any): Promise<Uint8Array> => {
  // needed for CF workers which return array buffers
  if (d instanceof ArrayBuffer) {
    return new Uint8Array(d)
  }

  // can make this in browser / node build
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
  throw new Error('432')
}

export const requestFullData = (client: BasedClient, id: number) => {
  const sub = client.observeState.get(id)
  addGetToQueue(client, sub.name, id, sub.payload)
}
