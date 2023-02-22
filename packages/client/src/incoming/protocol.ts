import { BasedClient } from '..'
import { addGetToQueue } from '../outgoing'

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
  //   5 = errorData // TODO: make this 7.0 and channelMessage 5
  //   6 = publish requesChannelName
  //   7.0 = channelMessage
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

export const requestFullData = (client: BasedClient, id: number) => {
  const sub = client.observeState.get(id)
  if (!sub) {
    console.warn(`Cannot find query function name for id from diff [id]`)
    return
  }
  addGetToQueue(client, sub.name, id, sub.payload)
}
