import { deflateSync } from 'fflate'
import { AuthState } from '../types/auth.js'
import { writeUint32, writeUint64, writeUint24, ENCODER } from '@saulx/utils'
import {
  ChannelPublishQueueItem,
  ChannelQueueItem,
  FunctionQueueItem,
  GetObserveQueue,
  ObserveQueue,
  StreamQueueItem,
} from '../types/index.js'
import {
  CONTENT_TYPE_JSON_U8,
  CONTENT_TYPE_UINT8_ARRAY_U8,
  CONTENT_TYPE_STRING_U8,
  CONTENT_TYPE_UNDEFINED_U8,
  CONTENT_TYPE_NULL,
} from '../contentType.js'

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

const COMPRESS_FROM_BYTES = 150

export type ValueBuffer = {
  contentByte: Uint8Array
  buf: Uint8Array
  deflate: boolean
}

const EMPTY_BUFFER = new Uint8Array([])

// pass buffer and offset
export const encodePayloadV2 = (
  payload: any,
  deflate: boolean,
): ValueBuffer => {
  if (payload === undefined) {
    return {
      contentByte: CONTENT_TYPE_UNDEFINED_U8,
      deflate: false,
      buf: EMPTY_BUFFER,
    }
  }

  if (typeof payload === 'string') {
    const buf = ENCODER.encode(payload)
    if (deflate && buf.byteLength > COMPRESS_FROM_BYTES) {
      return {
        contentByte: CONTENT_TYPE_STRING_U8,
        buf: deflateSync(buf),
        deflate: true,
      }
    }
    return {
      contentByte: CONTENT_TYPE_STRING_U8,
      buf,
      deflate: false,
    }
  }

  // mark as based db query object
  if (payload instanceof Uint8Array) {
    return {
      contentByte: CONTENT_TYPE_UINT8_ARRAY_U8,
      buf: payload,
      deflate: false,
    }
  }

  const buf = ENCODER.encode(JSON.stringify(payload))

  if (buf.byteLength > COMPRESS_FROM_BYTES) {
    return {
      contentByte: CONTENT_TYPE_JSON_U8,
      buf: deflateSync(buf),
      deflate: true,
    }
  }
  const result = {
    contentByte: CONTENT_TYPE_JSON_U8,
    buf,
    deflate: false,
  }

  return result
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
    const val = encodePayloadV2(payload, true)
    len += val.buf.byteLength + 1
    const buffLen = 16
    len += buffLen
    const buff = createBuffer(type, val.deflate, len, 5 + buffLen)
    writeUint64(buff, id, 4)
    writeUint64(buff, checksum, 12)
    buff[20] = n.length
    return { buffers: [buff, n, val.contentByte, val.buf], len }
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
  const val = encodePayloadV2(payload, false)
  len += val.buf.byteLength + 1
  const buffLen = 8
  len += buffLen
  const buff = createBuffer(5, isRequestSubscriber, len, 5 + buffLen)
  writeUint64(buff, id, 4)
  buff[12] = n.length

  return { buffers: [buff, n, val.contentByte, val.buf], len }
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
  const val = encodePayloadV2(payload, true)
  len += val.buf.byteLength + 1
  const buffLen = 16
  len += buffLen
  const buff = createBuffer(type, val.deflate, len, 5 + buffLen)
  writeUint64(buff, id, 4)
  writeUint64(buff, checksum, 12)
  buff[20] = n.length
  return { buffers: [buff, n, val.contentByte, val.buf], len }
}

export const encodeFunctionMessage = (
  f: FunctionQueueItem,
): { buffers: Uint8Array[]; len: number } => {
  // | 4 header | 3 id | 1 name length | * name | * payload |
  let len = 7
  const [id, name, payload] = f
  const n = encoder.encode(name)
  len += 1 + n.length
  const val = encodePayloadV2(payload, true)
  len += val.buf.byteLength + 1
  const buff = createBuffer(0, val.deflate, len, 8)
  writeUint24(buff, id, 4)
  buff[7] = n.length
  return { buffers: [buff, n, val.contentByte, val.buf], len }
}

export const encodePublishMessage = (
  f: ChannelPublishQueueItem,
): { buffers: Uint8Array[]; len: number } => {
  // | 4 header | 8 id | * payload |
  let len = 12
  const [id, payload] = f
  const val = encodePayloadV2(payload, true)
  len += val.buf.byteLength + 1
  const buff = createBuffer(6, val.deflate, len, 12)
  writeUint64(buff, id, 4)
  return { buffers: [buff, val.contentByte, val.buf], len }
}

export const encodeAuthMessage = (authState: AuthState) => {
  // | 4 header | * payload |
  let len = 4
  const val = encodePayloadV2(authState, true)
  len += val.buf.byteLength + 1
  const buff = createBuffer(4, val.deflate, len)
  buff[4] = val.contentByte[0]
  if (val.buf.byteLength) {
    buff.set(val.buf, 5)
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

    const val = encodePayloadV2(payload, true)
    len += val.buf.byteLength + 1

    const mimeTypeEncoded = encoder.encode(mimeType)
    len += mimeTypeEncoded.length

    const fnNameEncoded = encoder.encode(fnName)
    len += fnNameEncoded.length

    const extensionEncoded = encoder.encode(extension)
    len += extensionEncoded.length

    const buff = createBuffer(7, val.deflate, len, sLen)

    buff[4] = 1
    writeUint24(buff, reqId, 5)
    writeUint32(buff, contentSize, 8)
    buff[12] = nameEncoded.length
    buff[13] = mimeTypeEncoded.length
    buff[14] = fnNameEncoded.length
    buff[15] = extensionEncoded.length

    return {
      buffers: [
        buff,
        nameEncoded,
        mimeTypeEncoded,
        fnNameEncoded,
        extensionEncoded,
        val.contentByte,
        val.buf,
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
    // fix fix
    const buff = createBuffer(7, isDeflate, len, sLen)
    buff[4] = 2
    writeUint24(buff, reqId, 5)
    buff[8] = seqId
    return { buffers: [buff, processed], len }
  }

  return { buffers: [], len: 0 }
}
