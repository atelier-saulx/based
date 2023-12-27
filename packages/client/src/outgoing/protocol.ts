import { deflateSync } from 'fflate'
import { AuthState } from '../types/auth.js'
import {
  ChannelPublishQueueItem,
  ChannelQueueItem,
  FunctionQueueItem,
  GetObserveQueue,
  ObserveQueue,
} from '../types/index.js'

const encoder = new TextEncoder()

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
  //   5 = subscribeChannel
  //   6 = publishChannel
  //   7 = unsubscribeChannel
  // isDeflate (1 bit)
  // len (28 bits)

  // @ts-ignore
  const encodedMeta = (type << 1) + (isDeflate | 0)
  const nr = (len << 4) + encodedMeta
  return nr
}

const createBuffer = (
  type: number,
  isDeflate: boolean,
  len: number,
  size: number = len
): Uint8Array => {
  const header = encodeHeader(type, isDeflate, len)
  const buff = new Uint8Array(size)
  storeUint8(buff, header, 0, 4)
  return buff
}

const encodePayload = (
  payload: any,
  noDeflate = false
): [boolean, Uint8Array] | [boolean] => {
  let p: Uint8Array
  let isDeflate = false
  if (payload !== undefined) {
    p = encoder.encode(
      typeof payload === 'string' ? payload : JSON.stringify(payload)
    )
    if (!noDeflate && p.length > 150) {
      p = deflateSync(p)
      isDeflate = true
    }
    return [isDeflate, p]
  }
  return [false]
}

export const encodeGetObserveMessage = (
  id: number,
  o: GetObserveQueue extends Map<any, infer I> ? I : never
): { buffers: Uint8Array[]; len: number } => {
  let len = 4
  const [type, name, checksum, payload] = o

  // Type 3 = get
  // | 4 header | 8 id | 8 checksum | 1 name length | * name | * payload |

  if (type === 3) {
    const n = encoder.encode(name)
    len += 1 + n.length
    const [isDeflate, p] = encodePayload(payload)
    if (p) {
      len += p.length
    }

    const buffLen = 16
    len += buffLen
    const buff = createBuffer(type, isDeflate, len, 5 + buffLen)

    storeUint8(buff, id, 4, 8)
    storeUint8(buff, checksum, 12, 8)
    buff[20] = n.length
    if (p) {
      return { buffers: [buff, n, p], len }
    } else {
      return { buffers: [buff, n], len }
    }
  }

  return { buffers: [], len: 0 }
}

export const encodeSubscribeChannelMessage = (
  id: number,
  o: ChannelQueueItem
): { buffers: Uint8Array[]; len: number } => {
  let len = 4
  const [type, name, payload] = o

  // Type 5 = subscribe
  // | 4 header | 8 id | 1 name length | * name | * payload |

  // Type 7 = unsubscribe
  // | 4 header | 8 id |

  if (type === 7) {
    const buff = createBuffer(type, false, 12)
    storeUint8(buff, id, 4, 8)
    return { buffers: [buff], len: 12 }
  }
  const n = encoder.encode(name)
  len += 1 + n.length
  const isRequestSubscriber = type === 6
  const [, p] = encodePayload(payload, true)
  if (p) {
    len += p.length
  }
  const buffLen = 8
  len += buffLen
  const buff = createBuffer(5, isRequestSubscriber, len, 5 + buffLen)
  storeUint8(buff, id, 4, 8)
  buff[12] = n.length
  if (p) {
    return { buffers: [buff, n, p], len }
  }
  return { buffers: [buff, n], len }
}

export const encodeObserveMessage = (
  id: number,
  o: ObserveQueue extends Map<any, infer I> ? I : never
): { buffers: Uint8Array[]; len: number } => {
  let len = 4
  const [type, name, checksum, payload] = o
  // Type 1 = subscribe
  // | 4 header | 8 id | 8 checksum | 1 name length | * name | * payload |

  // Type 2 = unsubscribe
  // | 4 header | 8 id |
  if (type === 2) {
    const buff = createBuffer(type, false, 12)
    storeUint8(buff, id, 4, 8)
    return { buffers: [buff], len: 12 }
  }
  const n = encoder.encode(name)
  len += 1 + n.length
  const [isDeflate, p] = encodePayload(payload)
  if (p) {
    len += p.length
  }
  const buffLen = 16
  len += buffLen
  const buff = createBuffer(type, isDeflate, len, 5 + buffLen)
  storeUint8(buff, id, 4, 8)
  storeUint8(buff, checksum, 12, 8)
  buff[20] = n.length
  if (p) {
    return { buffers: [buff, n, p], len }
  }
  return { buffers: [buff, n], len }
}

export const encodeFunctionMessage = (
  f: FunctionQueueItem
): { buffers: Uint8Array[]; len: number } => {
  // | 4 header | 3 id | 1 name length | * name | * payload |
  let len = 7
  const [id, name, payload] = f
  const n = encoder.encode(name)
  len += 1 + n.length
  const [isDeflate, p] = encodePayload(payload)
  if (p) {
    len += p.length
  }
  const buff = createBuffer(0, isDeflate, len, 8)
  storeUint8(buff, id, 4, 3)
  buff[7] = n.length
  if (p) {
    return { buffers: [buff, n, p], len }
  }
  return { buffers: [buff, n], len }
}

export const encodePublishMessage = (
  f: ChannelPublishQueueItem
): { buffers: Uint8Array[]; len: number } => {
  // | 4 header | 8 id | * payload |
  let len = 12
  const [id, payload] = f
  const [isDeflate, p] = encodePayload(payload)
  if (p) {
    len += p.length
  }
  const buff = createBuffer(6, isDeflate, len, 12)
  storeUint8(buff, id, 4, 8)
  if (p) {
    return { buffers: [buff, p], len }
  }
  return { buffers: [buff], len }
}

export const encodeAuthMessage = (authState: AuthState) => {
  // | 4 header | * payload |
  let len = 4
  const [isDeflate, payload] = encodePayload(authState)
  if (payload) {
    len += payload.length
  }
  const buff = createBuffer(4, isDeflate, len)
  if (payload) {
    buff.set(payload, 4)
  }
  return buff
}
