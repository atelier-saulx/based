import zlib from 'node:zlib'
import {
  DECODER,
  ENCODER,
  writeUint32,
  writeUint24,
  writeUint64,
  readUint32,
} from '@saulx/utils'

export const COMPRESS_FROM_BYTES = 150

export const decodeHeader = (
  nr: number,
): { type: number; isDeflate: boolean; len: number } => {
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

// add buffer
const encodeHeader = (
  type: number,
  isDeflate: boolean,
  len: number,
  buffer: Uint8Array,
  offset: number,
) => {
  // 4 bytes
  // type (3 bits)
  //   0 = functionData
  //   1 = subscriptionData
  //   2 = subscriptionDiffData
  //   3 = get
  //   4 = authData
  //   5 = errorData
  //   6 = channelMessage
  //   7 = requestChannelId TODO: later...
  // isDeflate (1 bit)
  // len (28 bits)
  const encodedMeta = (type << 1) + (Number(isDeflate) | 0)
  const nr = (len << 4) + encodedMeta
  writeUint32(buffer, nr, offset)
}

export const CONTENT_TYPE_JSON = new Uint8Array([255])
export const CONTENT_TYPE_UINT8_ARRAY = new Uint8Array([254])
export const CONTENT_TYPE_STRING = new Uint8Array([253])
export const CONTENT_TYPE_UNDEFINED = new Uint8Array([252])
export const CONTENT_TYPE_NULL = new Uint8Array([251])
export const CONTENT_TYPE_VERSION_1 = new Uint8Array([250])

export type CONTENT_TYPE =
  | typeof CONTENT_TYPE_JSON
  | typeof CONTENT_TYPE_UINT8_ARRAY
  | typeof CONTENT_TYPE_STRING
  | typeof CONTENT_TYPE_UNDEFINED
  | typeof CONTENT_TYPE_NULL
  | typeof CONTENT_TYPE_VERSION_1

const EMPTY_BUFFER = new Uint8Array([])

export const cacheV2toV1 = (buf: Uint8Array): Uint8Array => {
  // 12 + 8
  const n = new Uint8Array(buf.byteLength - 1)
  n.set(buf.subarray(0, 20), 0)
  n.set(buf.subarray(21), 20)
  return n
}

export const diffV2toV1 = (buf: Uint8Array): Uint8Array => {
  // totally wrong...
  // 12 + 16
  const n = new Uint8Array(buf.byteLength - 1)
  n.set(buf.subarray(0, 28), 0)
  n.set(buf.subarray(29), 28)

  return n
}

export type ValueBuffer = {
  contentByte: Uint8Array
  buf: Uint8Array
  deflate: boolean
}

export const valueToBufferV1 = (
  payload: any,
  deflate: boolean,
): ValueBuffer => {
  let buf: Uint8Array
  if (payload === undefined) {
    buf = Buffer.from([])
  } else {
    buf = Buffer.from(JSON.stringify(payload))
  }
  if (deflate && payload.byteLength > COMPRESS_FROM_BYTES) {
    return {
      contentByte: CONTENT_TYPE_VERSION_1,
      buf: zlib.deflateRawSync(buf, {}),
      deflate: true,
    }
  }
  return {
    contentByte: CONTENT_TYPE_VERSION_1,
    buf,
    deflate: false,
  }
}

export const valueToBuffer = (payload: any, deflate: boolean): ValueBuffer => {
  if (payload === undefined) {
    return {
      contentByte: CONTENT_TYPE_UNDEFINED,
      deflate: false,
      buf: EMPTY_BUFFER,
    }
  }

  if (typeof payload === 'string') {
    const buf = ENCODER.encode(payload)
    if (deflate && buf.byteLength > COMPRESS_FROM_BYTES) {
      return {
        contentByte: CONTENT_TYPE_STRING,
        buf: zlib.deflateRawSync(buf, {}),
        deflate: true,
      }
    }
    return {
      contentByte: CONTENT_TYPE_STRING,
      buf,
      deflate: false,
    }
  }

  // mark as based db query object
  if (payload instanceof Uint8Array) {
    if (deflate && payload.byteLength > COMPRESS_FROM_BYTES) {
      return {
        contentByte: CONTENT_TYPE_UINT8_ARRAY,
        buf: zlib.deflateRawSync(payload, {}),
        deflate: true,
      }
    }
    return {
      contentByte: CONTENT_TYPE_UINT8_ARRAY,
      buf: payload,
      deflate: false,
    }
  }

  const buf = ENCODER.encode(JSON.stringify(payload))

  if (buf.byteLength > COMPRESS_FROM_BYTES) {
    return {
      contentByte: CONTENT_TYPE_JSON,
      buf: zlib.deflateRawSync(buf, {}),
      deflate: true,
    }
  }
  const result = {
    contentByte: CONTENT_TYPE_JSON,
    buf,
    deflate: false,
  }

  return result
}

export const decodePayload = (payload: Uint8Array, isDeflate: boolean): any => {
  if (!isDeflate) {
    return DECODER.decode(payload)
  }
  try {
    const buffer = zlib.inflateRawSync(payload)
    return DECODER.decode(buffer)
  } catch (err) {
    console.error('Error deflating payload', err)
  }
}

export const parsePayload = (payload: any): any => {
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload)
    } catch (err) {}
  }
  return payload
}

export const decodeName = (
  arr: Uint8Array,
  start: number,
  end: number,
): string => {
  return DECODER.decode(arr.subarray(start, end))
}

export const encodeFunctionResponse = (
  id: number,
  val: ValueBuffer,
): Uint8Array => {
  // Type 0
  // | 4 header | 3 id | * payload |
  const chunks = 1
  if (chunks === 1) {
    const headerSize = 4
    const idSize = 3
    const isOld = val.contentByte[0] === CONTENT_TYPE_VERSION_1[0]
    if (isOld) {
      const msgSize = idSize + val.buf.byteLength
      const array = new Uint8Array(headerSize + msgSize)
      encodeHeader(0, val.deflate, msgSize, array, 0)
      writeUint24(array, id, 4)
      if (val.buf.byteLength) {
        array.set(val.buf, 7)
      }
      return array
    } else {
      const msgSize = idSize + val.buf.byteLength + 1
      const array = new Uint8Array(headerSize + msgSize)
      encodeHeader(0, val.deflate, msgSize, array, 0)
      writeUint24(array, id, 4)
      array[7] = val.contentByte[0]
      if (val.buf.byteLength) {
        array.set(val.buf, 8)
      }
      return array
    }
  } else {
    console.warn('Function response to chunks not implemented yet')
    return new Uint8Array(0)
  }
}

export const encodeStreamFunctionResponse = (
  id: number,
  val: ValueBuffer,
): Uint8Array => {
  // Type 7
  // | 4 header | 1 subType | 3 id | * payload |
  const chunks = 1
  if (chunks === 1) {
    const headerSize = 4
    const idSize = 3
    const subTypeSize = 1
    const isOld = val.contentByte[0] === CONTENT_TYPE_VERSION_1[0]
    if (isOld) {
      const msgSize = idSize + subTypeSize + val.buf.byteLength
      const array = new Uint8Array(headerSize + msgSize)
      encodeHeader(7, val.deflate, msgSize, array, 0)
      array[1] = 1
      writeUint24(array, id, 5)
      if (val.buf.byteLength) {
        array.set(val.buf, 8)
      }
      return array
    } else {
      const msgSize = idSize + subTypeSize + val.buf.byteLength + 1
      const array = new Uint8Array(headerSize + msgSize)
      encodeHeader(7, val.deflate, msgSize, array, 0)
      array[1] = 1
      writeUint24(array, id, 5)
      array[8] = val.contentByte[0]
      if (val.buf.byteLength) {
        array.set(val.buf, 9)
      }
      return array
    }
  } else {
    console.warn('Stream response to chunks not implemented yet')
    return new Uint8Array(0)
  }
}

export const encodeStreamFunctionChunkResponse = (
  id: number,
  seqId: number,
  code: number = 0,
  maxChunkSize: number = 0,
): Uint8Array => {
  // Type 7.2
  // | 4 header | 1 subType | 3 id | 1 seqId | 1 code | maxChunkSize?
  let msgSize = 6

  if (maxChunkSize) {
    msgSize += 3
  }

  const array = new Uint8Array(4 + msgSize)
  encodeHeader(7, false, msgSize, array, 0)
  array[4] = 2
  writeUint24(array, id, 5)
  array[8] = seqId
  array[9] = code

  if (maxChunkSize) {
    writeUint24(array, maxChunkSize, 10)
  }

  return array
}

export const encodeGetResponse = (id: number): Uint8Array => {
  // Type 4
  // | 4 header | 8 id |
  const array = new Uint8Array(12)
  encodeHeader(3, false, 8, array, 0)
  writeUint64(array, id, 4)
  return array
}

export const updateId = (payload: Uint8Array, id: number): Uint8Array => {
  const prevId = payload.slice(4, 12) // does this actually copy! CHECK
  writeUint64(payload, id, 4)
  return prevId
}

export const encodeObservableResponse = (
  id: number,
  checksum: number,
  val: ValueBuffer,
): [Uint8Array, boolean] => {
  // Type 1 (full data)
  // | 4 header | 8 id | 8 checksum | * payload |

  const isOld = val.contentByte[0] === CONTENT_TYPE_VERSION_1[0]
  if (isOld) {
    const msgSize = 16 + val.buf.byteLength
    const array = new Uint8Array(4 + msgSize)
    encodeHeader(1, val.deflate, msgSize, array, 0)
    writeUint64(array, id, 4)
    writeUint64(array, checksum, 12)
    if (val.buf.byteLength) {
      array.set(val.buf, 20)
    }
    return [array, val.deflate]
  } else {
    const msgSize = 16 + val.buf.byteLength + 1
    const array = new Uint8Array(4 + msgSize)
    encodeHeader(1, val.deflate, msgSize, array, 0)
    writeUint64(array, id, 4)
    writeUint64(array, checksum, 12)
    array[20] = val.contentByte[0]
    if (val.buf.byteLength) {
      array.set(val.buf, 21)
    }
    return [array, val.deflate]
  }
}

export const encodeObservableDiffResponse = (
  id: number,
  checksum: number,
  previousChecksum: number,
  val: ValueBuffer,
): Uint8Array => {
  // Type 2 (diff data)
  // | 4 header | 8 id | 8 checksum | 8 previousChecksum | * diff |
  const isOld = val.contentByte[0] === CONTENT_TYPE_VERSION_1[0]
  if (isOld) {
    const msgSize = 24 + val.buf.byteLength
    const array = new Uint8Array(4 + msgSize)
    encodeHeader(2, val.deflate, msgSize, array, 0)
    writeUint64(array, id, 4)
    writeUint64(array, checksum, 12)
    writeUint64(array, previousChecksum, 20)
    if (val.buf.byteLength) {
      array.set(val.buf, 28)
    }
  } else {
    const msgSize = 24 + val.buf.byteLength + 1
    const array = new Uint8Array(4 + msgSize)
    encodeHeader(2, val.deflate, msgSize, array, 0)
    writeUint64(array, id, 4)
    writeUint64(array, checksum, 12)
    writeUint64(array, previousChecksum, 20)
    array[28] = val.contentByte[0]
    if (val.buf.byteLength) {
      array.set(val.buf, 29)
    }
    return array
  }
}

const encodeSimpleResponse = (type: number, val: ValueBuffer): Uint8Array => {
  // | 4 header | * payload |

  const isOld = val.contentByte[0] === CONTENT_TYPE_VERSION_1[0]
  if (isOld) {
    const headerSize = 4
    const msgSize = val.buf.byteLength
    const array = new Uint8Array(headerSize + msgSize)
    encodeHeader(type, val.deflate, msgSize, array, 0)
    if (val.buf.byteLength) {
      array.set(val.buf, 4)
    }
    return array
  } else {
    const headerSize = 4
    const msgSize = val.buf.byteLength + 1
    const array = new Uint8Array(headerSize + msgSize)
    encodeHeader(type, val.deflate, msgSize, array, 0)
    array[4] = val.contentByte[0]
    if (val.buf.byteLength) {
      array.set(val.buf, 5)
    }
    return array
  }
}

export const encodeAuthResponse = (val: ValueBuffer): Uint8Array => {
  // Type 4
  return encodeSimpleResponse(4, val)
}

export const encodeErrorResponse = (val: ValueBuffer): Uint8Array => {
  // Type 5
  return encodeSimpleResponse(5, val)
}

export const encodeChannelMessage = (
  id: number,
  val: ValueBuffer,
): Uint8Array => {
  // Type 7.0 (fill data)
  // | 4 header | 1 subType | 8 id | * payload |
  const isOld = val.contentByte[0] === CONTENT_TYPE_VERSION_1[0]
  if (isOld) {
    const msgSize = 8 + val.buf.byteLength
    const array = new Uint8Array(4 + msgSize)
    array[4] = 0
    encodeHeader(7, val.deflate, msgSize, array, 0)
    writeUint64(array, id, 5)
    if (val.buf.byteLength) {
      array.set(val.buf, 13)
    }
    return array
  } else {
    const msgSize = 8 + val.buf.byteLength + 1
    const array = new Uint8Array(4 + msgSize)
    array[4] = 0
    encodeHeader(7, val.deflate, msgSize, array, 0)
    writeUint64(array, id, 5)
    array[13] = val.contentByte[0]
    if (val.buf.byteLength) {
      array.set(val.buf, 14)
    }
    return array
  }
}

export const encodeReload = (type: number, seqId: number): Uint8Array => {
  // Type 7.3 (fill data)
  // 0 = all
  // 1 = browser
  // 2 = non-browser
  // | 4 header | 1 subType | 1 type \ 1 seqId
  const msgSize = 7
  const array = new Uint8Array(4 + msgSize)
  encodeHeader(7, false, msgSize, array, 0)
  array[4] = 3
  array[5] = type
  array[6] = seqId
  return array
}

export const decode = (buffer: Uint8Array): any => {
  const header = readUint32(buffer, 0)
  const { isDeflate, len, type } = decodeHeader(header)
  if (type === 1) {
    // | 4 header | 8 id | 8 checksum | * payload |
    if (len === 16) {
      return
    }
    const start = 20
    const end = len + 4
    return decodePayload(buffer.slice(start, end), isDeflate)
  }
}
