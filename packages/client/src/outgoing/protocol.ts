import { deflateSync } from 'fflate'
import { AuthState } from '../types/auth.js'
import { writeUint32, writeUint64, writeUint24 } from '@saulx/utils'
import {
  ChannelPublishQueueItem,
  ChannelQueueItem,
  FunctionQueueItem,
  GetObserveQueue,
  ObserveQueue,
  StreamQueueItem,
} from '../types/index.js'

const encoder = new TextEncoder()

const encodeHeader = (
  type: number,
  isDeflate: boolean,
  len: number,
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
  //   7.0 = unsubscribeChannel
  //   7.1 = register stream
  //   7.2 = chunk
  // isDeflate (1 bit)
  // len (28 bits)

  // @ts-ignore
  const encodedMeta = (type << 1) + (isDeflate | 0)
  const nr = (len << 4) + encodedMeta
  // write in the buffer
  return nr
}

const createBuffer = (
  type: number,
  isDeflate: boolean,
  len: number,
  size: number = len,
): Uint8Array => {
  const header = encodeHeader(type, isDeflate, len)
  const buf = new Uint8Array(size)

  writeUint32(buf, header, 0)
  return buf
}

const encodePayload = (
  payload: any,
  noDeflate = false,
): [boolean, Uint8Array] | [boolean] => {
  let p: Uint8Array
  let isDeflate = false
  if (payload !== undefined) {
    p = encoder.encode(
      typeof payload === 'string' ? payload : JSON.stringify(payload),
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
  o: GetObserveQueue extends Map<any, infer I> ? I : never,
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

    writeUint64(buff, id, 4)
    writeUint64(buff, checksum, 12)

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
  o: ChannelQueueItem,
): { buffers: Uint8Array[]; len: number } => {
  let len = 4
  const [type, name, payload] = o
  // Type 5 = subscribe
  // | 4 header | 8 id | 1 name length | * name | * payload |
  // Type 7 = unsubscribe
  // | 4 header | 1    = 0 | 8 id |
  if (type === 7) {
    const buff = createBuffer(type, false, 13)
    buff[4] = 0
    writeUint64(buff, id, 5)
    return { buffers: [buff], len: 13 }
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
  writeUint64(buff, id, 4)
  buff[12] = n.length
  if (p) {
    return { buffers: [buff, n, p], len }
  }
  return { buffers: [buff, n], len }
}

export const encodeObserveMessage = (
  id: number,
  o: ObserveQueue extends Map<any, infer I> ? I : never,
): { buffers: Uint8Array[]; len: number } => {
  let len = 4
  const [type, name, checksum, payload] = o
  // Type 1 = subscribe
  // | 4 header | 8 id | 8 checksum | 1 name length | * name | * payload |
  // Type 2 = unsubscribe
  // | 4 header | 8 id |
  if (type === 2) {
    const buff = createBuffer(type, false, 12)
    writeUint64(buff, id, 4)
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
  writeUint64(buff, id, 4)
  writeUint64(buff, checksum, 12)
  buff[20] = n.length
  if (p) {
    return { buffers: [buff, n, p], len }
  }
  return { buffers: [buff, n], len }
}

export const encodeFunctionMessage = (
  f: FunctionQueueItem,
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
  writeUint24(buff, id, 4)
  buff[7] = n.length
  if (p) {
    return { buffers: [buff, n, p], len }
  }
  return { buffers: [buff, n], len }
}

export const encodePublishMessage = (
  f: ChannelPublishQueueItem,
): { buffers: Uint8Array[]; len: number } => {
  // | 4 header | 8 id | * payload |
  let len = 12
  const [id, payload] = f
  const [isDeflate, p] = encodePayload(payload)
  if (p) {
    len += p.length
  }
  const buff = createBuffer(6, isDeflate, len, 12)
  writeUint64(buff, id, 4)
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

export const encodeStreamMessage = (
  f: StreamQueueItem,
): { buffers: Uint8Array[]; len: number } => {
  const [subType, reqId] = f

  // Type 7.1 Start stream
  // | 4 header | 1 subType = 1 | 3 reqId | 4 content-size | 1 nameLen | 1 mimeLen | 1 fnNameLen | 1 extensionLength | name | mime | fnName | extension | payload
  if (subType === 1) {
    const [, , contentSize, name, mimeType, extension, fnName, payload] = f

    let sLen = 16

    let len = sLen

    const nameEncoded = encoder.encode(name)
    len += nameEncoded.length

    const [isDeflate, p] = encodePayload(payload)

    if (p) {
      len += p.length
    }

    const mimeTypeEncoded = encoder.encode(mimeType)
    len += mimeTypeEncoded.length

    const fnNameEncoded = encoder.encode(fnName)
    len += fnNameEncoded.length

    const extensionEncoded = encoder.encode(extension)
    len += extensionEncoded.length

    const buff = createBuffer(7, isDeflate, len, sLen)

    buff[4] = 1
    writeUint24(buff, reqId, 5)
    writeUint32(buff, contentSize, 8)
    buff[12] = nameEncoded.length
    buff[13] = mimeTypeEncoded.length
    buff[14] = fnNameEncoded.length
    buff[15] = extensionEncoded.length

    if (p) {
      return {
        buffers: [
          buff,
          nameEncoded,
          mimeTypeEncoded,
          fnNameEncoded,
          extensionEncoded,
          p,
        ],
        len,
      }
    }
    return {
      buffers: [
        buff,
        nameEncoded,
        mimeTypeEncoded,
        fnNameEncoded,
        extensionEncoded,
      ],
      len,
    }
  } else if (subType === 2) {
    // Type 7.2 Chunk
    // | 4 header | 1 subType = 2 | 3 reqId | 1 seqId | content
    let sLen = 9
    let len = sLen
    const [, , seqId, chunk] = f
    let isDeflate = false
    let processed = chunk
    if (chunk.length > 150) {
      processed = deflateSync(chunk)
      len += processed.length
      isDeflate = true
    } else {
      len += chunk.length
    }
    const buff = createBuffer(7, isDeflate, len, sLen)
    buff[4] = 2
    writeUint24(buff, reqId, 5)
    buff[8] = seqId
    return { buffers: [buff, processed], len }
  }

  return { buffers: [], len: 0 }
}
