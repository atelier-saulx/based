import zlib from 'node:zlib'

const textDecoder = new TextDecoder()

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

export const storeUint8 = (
  buff: Uint8Array,
  n: number,
  start: number,
  len: number,
) => {
  for (let index = start; index < start + len; index++) {
    const byte = n & 0xff
    buff[index] = byte
    n = (n - byte) / 256
  }
}

export const readUint8 = (
  buff: Uint8Array,
  start: number,
  len: number,
): number => {
  let n = 0
  const s = len - 1 + start
  for (let i = s; i >= start; i--) {
    n = n * 256 + buff[i]
  }
  return n
}

export const encodeHeader = (
  type: number,
  isDeflate: boolean,
  len: number,
): number => {
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
  return nr
}

export const CONTENT_TYPE_JSON = 255
export const CONTENT_TYPE_UINT8_ARRAY = 254
export const CONTENT_TYPE_STRING = 253
export const CONTENT_TYPE_UNDEFINED = 252
export const CONTENT_TYPE_NULL = 251

export type CONTENT_TYPE =
  | typeof CONTENT_TYPE_JSON
  | typeof CONTENT_TYPE_UINT8_ARRAY
  | typeof CONTENT_TYPE_STRING
  | typeof CONTENT_TYPE_UNDEFINED
  | typeof CONTENT_TYPE_NULL

export const cacheV2toV1 = (buf: Uint8Array): Uint8Array => {
  // 12 + 8
  const n = new Uint8Array(buf.byteLength - 1)
  n.set(buf.subarray(0, 20), 0)
  n.set(buf.subarray(21), 20)
  return n
}

export const diffV2toV1 = (buf: Uint8Array): Uint8Array => {
  // 12 + 16
  const n = new Uint8Array(buf.byteLength - 1)
  n.set(buf.subarray(0, 28), 0)
  n.set(buf.subarray(29), 28)

  return n
}

export const valueToBufferV1 = (payload: any): Buffer => {
  // can use a more elloborate typed response e.g. number etc in there
  if (payload === undefined) {
    return Buffer.from([])
  }
  // TODO: only stringify if not string...
  return Buffer.from(JSON.stringify(payload))
}

export const valueToBuffer = (payload: any): Buffer => {
  // Add BASED QUERY RESULT
  // super nice to receive on the client allrdy
  // can use a more elloborate typed response e.g. number etc in there
  if (payload === undefined) {
    return Buffer.from([CONTENT_TYPE_UNDEFINED])
  }

  if (payload === null) {
    return Buffer.from([CONTENT_TYPE_NULL])
  }

  if (typeof payload === 'string') {
    return Buffer.concat([
      Buffer.from([CONTENT_TYPE_STRING]),
      Buffer.from(payload),
    ])
  }

  // mark as query object

  if (payload instanceof Uint8Array) {
    return Buffer.concat([
      Buffer.from([CONTENT_TYPE_UINT8_ARRAY]),
      Buffer.from(payload),
    ])
  }

  return Buffer.concat([
    Buffer.from([CONTENT_TYPE_JSON]),
    Buffer.from(JSON.stringify(payload)),
  ])
}

export const decodePayload = (payload: Uint8Array, isDeflate: boolean): any => {
  if (!isDeflate) {
    return textDecoder.decode(payload)
  }
  try {
    const buffer = zlib.inflateRawSync(payload)
    return textDecoder.decode(buffer)
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
  const name = new Uint8Array(arr.slice(start, end))
  return textDecoder.decode(name)
}

export const encodeFunctionResponse = (
  id: number,
  buffer: Buffer,
): Uint8Array => {
  // Type 0
  // | 4 header | 3 id | * payload |

  let isDeflate = false
  // TODO: implement for streams!
  // chunk isChunk | isNotCunk | isLastchunk 0|1 (use 1 bye for now?)
  const chunks = 1

  if (buffer.length > COMPRESS_FROM_BYTES) {
    isDeflate = true
    buffer = zlib.deflateRawSync(buffer, {})
  }

  if (chunks === 1) {
    const headerSize = 4
    const idSize = 3
    const msgSize = idSize + buffer.length
    const header = encodeHeader(0, isDeflate, msgSize)

    // not very nessecary but ok
    const array = new Uint8Array(headerSize + msgSize)
    storeUint8(array, header, 0, 4)
    storeUint8(array, id, 4, 3)
    if (buffer.length) {
      array.set(buffer, 7)
    }
    return array
  } else {
    console.warn('chunk not implemented yet')
    return new Uint8Array(0)
  }
}

export const encodeStreamFunctionResponse = (
  id: number,
  buffer: Buffer,
): Uint8Array => {
  // Type 7
  // | 4 header | 1 subType | 3 id | * payload |

  let isDeflate = false
  // TODO: implement for streams!
  // chunk isChunk | isNotCunk | isLastchunk 0|1 (use 1 bye for now?)
  const chunks = 1

  if (buffer.length > COMPRESS_FROM_BYTES) {
    isDeflate = true
    buffer = zlib.deflateRawSync(buffer, {})
  }

  if (chunks === 1) {
    const headerSize = 4
    const idSize = 3
    const subTypeSize = 1
    const msgSize = idSize + subTypeSize + buffer.length
    const header = encodeHeader(7, isDeflate, msgSize)

    // not very nessecary but ok
    const array = new Uint8Array(headerSize + msgSize)
    storeUint8(array, header, 0, 4)
    storeUint8(array, 1, 4, 1)
    storeUint8(array, id, 5, 3)
    if (buffer.length) {
      array.set(buffer, 8)
    }
    return array
  } else {
    console.warn('chunk not implemented yet')
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

  const header = encodeHeader(7, false, msgSize)

  const array = new Uint8Array(4 + msgSize)

  storeUint8(array, header, 0, 4)
  storeUint8(array, 2, 4, 1)
  storeUint8(array, id, 5, 3)
  storeUint8(array, seqId, 8, 1)
  storeUint8(array, code, 9, 1)

  if (maxChunkSize) {
    storeUint8(array, maxChunkSize, 10, 3)
  }

  return array
}

export const encodeGetResponse = (id: number): Uint8Array => {
  // Type 4
  // | 4 header | 8 id |
  const header = encodeHeader(3, false, 8)
  const array = new Uint8Array(12)
  storeUint8(array, header, 0, 4)
  storeUint8(array, id, 4, 8)
  return array
}

export const updateId = (payload: Uint8Array, id: number): Uint8Array => {
  const prevId = payload.slice(4, 12)
  storeUint8(payload, id, 4, 8)
  return prevId
}

export const encodeObservableResponse = (
  id: number,
  checksum: number,
  buffer: Buffer,
): [Uint8Array, boolean] => {
  // Type 1 (full data)
  // | 4 header | 8 id | 8 checksum | * payload |

  let isDeflate = false

  if (buffer.length > COMPRESS_FROM_BYTES) {
    isDeflate = true
    buffer = zlib.deflateRawSync(buffer, {})
  }

  const msgSize = 16 + buffer.length
  const header = encodeHeader(1, isDeflate, msgSize)
  const array = new Uint8Array(4 + msgSize)
  storeUint8(array, header, 0, 4)
  storeUint8(array, id, 4, 8)
  storeUint8(array, checksum, 12, 8)
  if (buffer.length) {
    array.set(buffer, 20)
  }
  return [array, isDeflate]
}

export const encodeObservableDiffResponse = (
  id: number,
  checksum: number,
  previousChecksum: number,
  buffer: Buffer,
): Uint8Array => {
  // Type 2 (diff data)
  // | 4 header | 8 id | 8 checksum | 8 previousChecksum | * diff |
  let isDeflate = false

  if (buffer.length > COMPRESS_FROM_BYTES) {
    isDeflate = true
    buffer = zlib.deflateRawSync(buffer, {})
  }

  const msgSize = 24 + buffer.length
  const header = encodeHeader(2, isDeflate, msgSize)
  const array = new Uint8Array(4 + msgSize)
  storeUint8(array, header, 0, 4)
  storeUint8(array, id, 4, 8)
  storeUint8(array, checksum, 12, 8)
  storeUint8(array, previousChecksum, 20, 8)
  if (buffer.length) {
    array.set(buffer, 28)
  }
  return array
}

const encodeSimpleResponse = (type: number, buffer: Buffer): Uint8Array => {
  // | 4 header | * payload |
  let isDeflate = false

  if (buffer.length > COMPRESS_FROM_BYTES) {
    isDeflate = true
    buffer = zlib.deflateRawSync(buffer, {})
  }

  const headerSize = 4
  const msgSize = buffer.length
  const header = encodeHeader(type, isDeflate, msgSize)
  const array = new Uint8Array(headerSize + msgSize)
  storeUint8(array, header, 0, 4)
  if (buffer.length) {
    array.set(buffer, 4)
  }
  return array
}

export const encodeAuthResponse = (buffer: Buffer): Uint8Array => {
  // Type 4
  return encodeSimpleResponse(4, buffer)
}

export const encodeErrorResponse = (buffer: Buffer): Uint8Array => {
  // Type 5
  return encodeSimpleResponse(5, buffer)
}

export const encodeChannelMessage = (
  id: number,
  buffer: Buffer,
): Uint8Array => {
  // Type 7.0 (fill data)
  // | 4 header | 1 subType | 8 id | * payload |
  let isDeflate = false
  if (buffer.length > COMPRESS_FROM_BYTES) {
    isDeflate = true
    buffer = zlib.deflateRawSync(buffer, {})
  }
  const msgSize = 8 + buffer.length + 1
  const header = encodeHeader(7, isDeflate, msgSize)
  const array = new Uint8Array(4 + msgSize)
  storeUint8(array, 0, 4, 1)
  storeUint8(array, header, 0, 4)
  storeUint8(array, id, 5, 8)
  if (buffer.length) {
    array.set(buffer, 13)
  }
  return array
}

export const encodeReload = (type: number, seqId: number): Uint8Array => {
  // Type 7.3 (fill data)
  // 0 = all
  // 1 = browser
  // 2 = non-browser
  // | 4 header | 1 subType | 1 type \ 1 seqId
  const msgSize = 7
  const header = encodeHeader(7, false, msgSize)
  const array = new Uint8Array(4 + msgSize)
  storeUint8(array, header, 0, 4)
  storeUint8(array, 3, 4, 1)
  storeUint8(array, type, 5, 1)
  storeUint8(array, seqId, 6, 1)
  return array
}

export const decode = (buffer: Uint8Array): any => {
  const header = readUint8(buffer, 0, 4)
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
