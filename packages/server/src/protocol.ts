import zlib from 'node:zlib'
import {
  DECODER,
  ENCODER,
  writeUint32,
  writeUint24,
  writeUint64,
  readUint32,
} from '@based/utils'
import { BasedQueryResponse } from '@based/db'
import { serializeReaderSchema } from '@based/protocol/db-read/serialize-schema'
import { deSerializeSchema, resultToObject } from '@based/protocol/db-read'
import {
  FunctionClientSubType,
  FunctionClientType,
  FunctionServerType,
} from '@based/protocol/client-server'
import { WebSocketSession } from '@based/functions'

export const COMPRESS_FROM_BYTES = 150

export const decodeHeader = (
  nr: number,
): { type: FunctionServerType; isDeflate: boolean; len: number } => {
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

export const CONTENT_TYPE_JSON_U8 = new Uint8Array([255])
export const CONTENT_TYPE_UINT8_ARRAY_U8 = new Uint8Array([254])
export const CONTENT_TYPE_STRING_U8 = new Uint8Array([253])
export const CONTENT_TYPE_UNDEFINED_U8 = new Uint8Array([252])
export const CONTENT_TYPE_NULL_U8 = new Uint8Array([251])
export const CONTENT_TYPE_VERSION_1_U8 = new Uint8Array([250])
export const CONTENT_TYPE_DB_QUERY = new Uint8Array([249])

const EMPTY_BUFFER = new Uint8Array([])

export const parseIncomingQueryPayload = (
  arr: Uint8Array,
  start: number,
  headerLen: number,
  len: number,
  session: WebSocketSession,
  isDeflate: boolean,
) => {
  // headerLen:nameLen + 21
  return len === headerLen
    ? undefined
    : decodePayload(
        new Uint8Array(arr.slice(start + headerLen, start + len)),
        isDeflate,
        session.v < 2,
      )
}

export const cacheV2toV1 = (buf: Uint8Array): Uint8Array => {
  // 12 + 8
  const isString = buf[20] === CONTENT_TYPE_STRING_U8[0]
  if (isString) {
    const header = decodeHeader(readUint32(buf, 0))
    if (!header.isDeflate) {
      const n = new Uint8Array(buf.byteLength - 1 + 2)
      n.set(buf.subarray(0, 20), 0)
      encodeHeader(header.type, header.isDeflate, header.len + 1, n, 0)
      n[20] = 34 // "
      n.set(buf.subarray(21), 21)
      n[n.byteLength - 1] = 34 // "
      return n
    } else {
      // very heavy rly sad..
      const valBuffer = decodePayload(buf.subarray(20), true, false)
      const newEncoded = valueToBufferV1(valBuffer, true)
      const len = newEncoded.buf.byteLength
      const n = new Uint8Array(20 + len)
      n.set(buf.subarray(0, 20), 0)
      encodeHeader(header.type, header.isDeflate, 20 + len, n, 0)
      n.set(newEncoded.buf, 20)
      return n
    }
  } else if (buf[20] === CONTENT_TYPE_DB_QUERY[0]) {
    const header = decodeHeader(readUint32(buf, 0))
    const slice = buf.subarray(21)
    const schemaLen = readUint32(slice, 0)
    const schema = deSerializeSchema(slice.subarray(4, schemaLen + 4))
    const result = slice.subarray(schemaLen + 4)
    const jsonBuf = ENCODER.encode(
      JSON.stringify(resultToObject(schema, result, result.byteLength)),
    )
    const n = new Uint8Array(20 + jsonBuf.byteLength)
    n.set(buf.subarray(0, 20), 0)
    encodeHeader(header.type, header.isDeflate, header.len - 1, n, 0)
    n.set(jsonBuf, 20)
    return n
  } else {
    const header = decodeHeader(readUint32(buf, 0))
    const n = new Uint8Array(buf.byteLength - 1)
    n.set(buf.subarray(0, 20), 0)
    encodeHeader(header.type, header.isDeflate, header.len - 1, n, 0)
    n.set(buf.subarray(21), 20)
    return n
  }
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
    buf = new Uint8Array([])
  } else if (payload instanceof BasedQueryResponse) {
    buf = ENCODER.encode(payload.toJSON())
  } else {
    try {
      buf = ENCODER.encode(JSON.stringify(payload))
    } catch (err) {
      console.log(payload)
      buf = ENCODER.encode(payload)
    }
  }
  if (deflate && buf.byteLength > COMPRESS_FROM_BYTES) {
    return {
      contentByte: CONTENT_TYPE_VERSION_1_U8,
      buf: zlib.deflateRawSync(buf, {}),
      deflate: true,
    }
  }
  return {
    contentByte: CONTENT_TYPE_VERSION_1_U8,
    buf,
    deflate: false,
  }
}

// pass buffer and offset
export const valueToBuffer = (payload: any, deflate: boolean): ValueBuffer => {
  if (payload === undefined) {
    return {
      contentByte: CONTENT_TYPE_UNDEFINED_U8,
      deflate: false,
      buf: EMPTY_BUFFER,
    }
  }

  if (payload === null) {
    return {
      contentByte: CONTENT_TYPE_NULL_U8,
      deflate: false,
      buf: EMPTY_BUFFER,
    }
  }

  if (typeof payload === 'string') {
    const buf = ENCODER.encode(payload)
    if (deflate && buf.byteLength > COMPRESS_FROM_BYTES) {
      return {
        contentByte: CONTENT_TYPE_STRING_U8,
        buf: zlib.deflateRawSync(buf, {}),
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

  if (payload instanceof BasedQueryResponse) {
    const serializedSchema = serializeReaderSchema(payload.def.readSchema)
    const res = payload.result.subarray(0, -4) // minus 4 for hash
    // keep 4 for serializedSchema byteLength
    const buf = new Uint8Array(4 + serializedSchema.byteLength + res.byteLength)
    writeUint32(buf, serializedSchema.byteLength, 0)
    buf.set(serializedSchema, 4)
    buf.set(res, serializedSchema.byteLength + 4)

    return {
      contentByte: CONTENT_TYPE_DB_QUERY,
      buf,
      deflate: false,
    }
  }

  const buf = ENCODER.encode(JSON.stringify(payload))

  if (buf.byteLength > COMPRESS_FROM_BYTES) {
    return {
      contentByte: CONTENT_TYPE_JSON_U8,
      buf: zlib.deflateRawSync(buf, {}),
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

export const decodePayloadV1 = (
  payload: Uint8Array,
  isDeflate: boolean,
): any => {
  if (!payload || payload.byteLength === 0) {
    return undefined
  }
  let p: any
  if (!isDeflate) {
    p = DECODER.decode(payload)
  } else {
    try {
      p = zlib.inflateRawSync(payload).toString()
    } catch (err) {
      console.error('Error deflating payload', err)
    }
  }
  if (typeof p === 'string') {
    try {
      return JSON.parse(p)
    } catch (err) {}
  }
  return p
}

export const decodePayload = (
  payload: Uint8Array,
  isDeflate: boolean,
  isOldClient: boolean,
): any => {
  if (isOldClient) {
    return decodePayloadV1(payload, isDeflate)
  }
  const contentType = payload[0]
  if (contentType === CONTENT_TYPE_UNDEFINED_U8[0]) {
    return undefined
  }
  if (contentType === CONTENT_TYPE_UINT8_ARRAY_U8[0]) {
    return payload.subarray(1)
  }
  if (contentType === CONTENT_TYPE_STRING_U8[0]) {
    if (isDeflate) {
      return zlib.inflateRawSync(payload.subarray(1)).toString()
    }
    return DECODER.decode(payload.subarray(1))
  }
  if (contentType === CONTENT_TYPE_JSON_U8[0]) {
    let str: string
    if (isDeflate) {
      str = zlib.inflateRawSync(payload.subarray(1)).toString()
    } else {
      str = DECODER.decode(payload.subarray(1))
    }
    if (typeof str === 'string') {
      try {
        return JSON.parse(str)
      } catch (err) {}
    }
    return str
  }
  if (contentType === CONTENT_TYPE_NULL_U8[0]) {
    return null
  }
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
  // | 4 header | 3 id | * payload |
  const headerSize = 4
  const idSize = 3
  const isOld = val.contentByte[0] === CONTENT_TYPE_VERSION_1_U8[0]
  if (isOld) {
    const msgSize = idSize + val.buf.byteLength
    const array = new Uint8Array(headerSize + msgSize)
    encodeHeader(FunctionClientType.function, val.deflate, msgSize, array, 0)
    writeUint24(array, id, 4)
    if (val.buf.byteLength) {
      array.set(val.buf, 7)
    }
    return array
  } else {
    const msgSize = idSize + val.buf.byteLength + 1
    const array = new Uint8Array(headerSize + msgSize)
    encodeHeader(FunctionClientType.function, val.deflate, msgSize, array, 0)
    writeUint24(array, id, 4)
    array[7] = val.contentByte[0]
    if (val.buf.byteLength) {
      array.set(val.buf, 8)
    }
    return array
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
    const isOld = val.contentByte[0] === CONTENT_TYPE_VERSION_1_U8[0]
    if (isOld) {
      const msgSize = idSize + subTypeSize + val.buf.byteLength
      const array = new Uint8Array(headerSize + msgSize)
      encodeHeader(FunctionClientType.subType, val.deflate, msgSize, array, 0)
      array[4] = FunctionClientSubType.streamFullResponse
      writeUint24(array, id, 5)
      if (val.buf.byteLength) {
        array.set(val.buf, 8)
      }
      return array
    } else {
      const msgSize = idSize + subTypeSize + val.buf.byteLength + 1
      const array = new Uint8Array(headerSize + msgSize)
      encodeHeader(FunctionClientType.subType, val.deflate, msgSize, array, 0)
      array[4] = FunctionClientSubType.streamFullResponse
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
  // | 4 header | 1 subType | 3 id | 1 seqId | 1 code | maxChunkSize?
  let msgSize = 6
  if (maxChunkSize) {
    msgSize += 3
  }
  const array = new Uint8Array(4 + msgSize)
  encodeHeader(FunctionClientType.subType, false, msgSize, array, 0)
  array[4] = FunctionClientSubType.streamChunkResponse
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
  encodeHeader(FunctionClientType.get, false, 8, array, 0)
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
  val: ValueBuffer, // USE THE VALUE
): [Uint8Array, boolean] => {
  // Type 1 (full data)
  // | 4 header | 8 id | 8 checksum | * payload |
  const isOld = val.contentByte[0] === CONTENT_TYPE_VERSION_1_U8[0]
  if (isOld) {
    const msgSize = 16 + val.buf.byteLength
    const array = new Uint8Array(4 + msgSize)
    encodeHeader(
      FunctionClientType.subscriptionData,
      val.deflate,
      msgSize,
      array,
      0,
    )
    writeUint64(array, id, 4)
    writeUint64(array, checksum, 12)
    if (val.buf.byteLength) {
      array.set(val.buf, 20)
    }
    return [array, val.deflate]
  } else {
    const msgSize = 16 + val.buf.byteLength + 1
    const array = new Uint8Array(4 + msgSize)
    encodeHeader(
      FunctionClientType.subscriptionData,
      val.deflate,
      msgSize,
      array,
      0,
    )
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
  val: ValueBuffer, // USE THE VALUE
): Uint8Array => {
  // Type 2 (diff data)
  // | 4 header | 8 id | 8 checksum | 8 previousChecksum | * diff |
  const isOld = val.contentByte[0] === CONTENT_TYPE_VERSION_1_U8[0]
  if (isOld) {
    const msgSize = 24 + val.buf.byteLength
    const array = new Uint8Array(4 + msgSize)
    encodeHeader(
      FunctionClientType.subscriptionDiff,
      val.deflate,
      msgSize,
      array,
      0,
    )
    writeUint64(array, id, 4)
    writeUint64(array, checksum, 12)
    writeUint64(array, previousChecksum, 20)
    if (val.buf.byteLength) {
      array.set(val.buf, 28)
    }
  } else {
    const msgSize = 24 + val.buf.byteLength + 1
    const array = new Uint8Array(4 + msgSize)
    encodeHeader(
      FunctionClientType.subscriptionDiff,
      val.deflate,
      msgSize,
      array,
      0,
    )
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

const encodeSimpleResponse = (
  type: FunctionClientType,
  val: ValueBuffer,
): Uint8Array => {
  // | 4 header | * payload |
  const isOld = val.contentByte[0] === CONTENT_TYPE_VERSION_1_U8[0]
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
  return encodeSimpleResponse(FunctionClientType.auth, val)
}

export const encodeErrorResponse = (val: ValueBuffer): Uint8Array => {
  return encodeSimpleResponse(FunctionClientType.error, val)
}

export const encodeChannelMessage = (
  id: number,
  val: ValueBuffer, // USE THE VALUE
): Uint8Array => {
  // Type 7.0 (fill data)
  // | 4 header | 1 subType | 8 id | * payload |
  const isOld = val.contentByte[0] === CONTENT_TYPE_VERSION_1_U8[0]
  if (isOld) {
    const msgSize = 8 + val.buf.byteLength + 1
    const array = new Uint8Array(4 + msgSize)
    // sub protocol 7.0
    array[4] = FunctionClientSubType.channel
    encodeHeader(FunctionClientType.subType, val.deflate, msgSize, array, 0)
    writeUint64(array, id, 5)
    if (val.buf.byteLength) {
      array.set(val.buf, 13)
    }
    return array
  } else {
    const msgSize = 8 + val.buf.byteLength + 2
    const array = new Uint8Array(4 + msgSize)
    encodeHeader(FunctionClientType.subType, val.deflate, msgSize, array, 0)
    array[4] = FunctionClientSubType.channel
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
  const msgSize = 3
  const array = new Uint8Array(4 + msgSize)
  encodeHeader(FunctionClientType.subType, false, msgSize, array, 0)
  array[4] = FunctionClientSubType.forceReload
  array[5] = type
  array[6] = seqId
  return array
}
