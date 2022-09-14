import fflate from 'fflate'
import { AuthState } from '../types/auth'
import { FunctionQueueItem } from '../types'

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

export const encodeGetObserveMessage = (
  id: number,
  o: any
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
    const header = encodeHeader(type, isDeflate, len)
    const buff = new Uint8Array(1 + 4 + buffLen)
    storeUint8(buff, header, 0, 4)
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

export const encodeObserveMessage = (
  id: number,
  o: any
): { buffers: Uint8Array[]; len: number } => {
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
  const header = encodeHeader(type, isDeflate, len)
  const buff = new Uint8Array(1 + 4 + buffLen)
  storeUint8(buff, header, 0, 4)
  storeUint8(buff, id, 4, 8)
  storeUint8(buff, checksum, 12, 8)
  buff[20] = n.length
  if (p) {
    return { buffers: [buff, n, p], len }
  } else {
    return { buffers: [buff, n], len }
  }
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
  const header = encodeHeader(0, isDeflate, len)
  const buff = new Uint8Array(4 + 3 + 1)
  storeUint8(buff, header, 0, 4)
  storeUint8(buff, id, 4, 3)
  buff[7] = n.length
  if (p) {
    return { buffers: [buff, n, p], len }
  }
  return { buffers: [buff, n], len }
  // l += len
}

export const encodeAuthMessage = (authState: AuthState) => {
  // | 4 header | * payload |
  let len = 4
  const [isDeflate, as] = encodePayload(authState)
  if (as) {
    len += as.length
  }
  const header = encodeHeader(4, isDeflate, len)
  const buff = new Uint8Array(4)
  storeUint8(buff, header, 0, 4)

  // TODO: remove LEN IS IN THE HEADER
  buff[4] = as.length
  const n = new Uint8Array(len)
  n.set(buff)
  if (as) {
    n.set(as, 4)
  }
  return n
}
