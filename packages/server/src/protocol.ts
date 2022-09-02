import zlib from 'node:zlib'

const textDecoder = new TextDecoder()

export const decodeHeader = (
  nr: number
): { type: number; isDeflate: boolean; len: number } => {
  // 4 bytes
  // type (3 bits)
  //   0 = function
  //   1 = subscribe
  //   2 = unsubscribe
  //   3 = get from observable
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
  len: number
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
  len: number
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
  len: number
): number => {
  // 4 bytes
  // type (3 bits)
  //   0 = functionData
  //   1 = subscriptionData
  //   2 = subscriptionDiffData
  // isDeflate (1 bit)
  // len (28 bits)
  const encodedMeta = (type << 1) + (isDeflate ? 1 : 0)
  const nr = (len << 4) + encodedMeta
  return nr
}

export const valueToBuffer = (payload: any): Buffer => {
  // can use a more elloborate typed response e.g. number etc in there
  if (payload === undefined) {
    return Buffer.from([])
  }
  // only stringify if not string...
  return Buffer.from(JSON.stringify(payload))
}

export const decodePayload = (payload: Uint8Array, isDeflate: boolean): any => {
  if (!isDeflate) {
    return textDecoder.decode(payload)
  }

  const buffer = zlib.inflateRawSync(payload)
  return textDecoder.decode(buffer)
}

export const decodeName = (
  arr: Uint8Array,
  start: number,
  end: number
): string => {
  const name = new Uint8Array(arr.slice(start, end))
  return textDecoder.decode(name)
}

export const encodeFunctionResponse = (
  id: number,
  buffer: Buffer
): Uint8Array => {
  // Type 0
  // | 4 header | 3 id | * payload |

  let isDeflate = false
  // implement later
  const chunks = 1

  if (buffer.length > 100) {
    isDeflate = true
    buffer = zlib.deflateRawSync(buffer, {})
  }

  if (chunks === 1) {
    const headerSize = 4
    const idSize = 3
    const msgSize = idSize + buffer.length
    const header = encodeHeader(0, isDeflate, msgSize)
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

export const encodeGetResponse = (id: number): Uint8Array => {
  // Type 4
  // | 4 header | 8 id |
  const header = encodeHeader(3, false, 8)
  const array = new Uint8Array(12)
  storeUint8(array, header, 0, 4)
  storeUint8(array, id, 4, 8)
  return array
}

export const encodeObservableResponse = (
  id: number,
  checksum: number,
  buffer: Buffer
): Uint8Array => {
  // Type 1 (full data)
  // | 4 header | 8 id | 8 checksum | * payload |

  let isDeflate = false
  // implement later
  const chunks = 1

  if (buffer.length > 100) {
    isDeflate = true
    buffer = zlib.deflateRawSync(buffer, {})
  }

  if (chunks === 1) {
    const msgSize = 16 + buffer.length
    const header = encodeHeader(1, isDeflate, msgSize)
    const array = new Uint8Array(4 + msgSize)
    storeUint8(array, header, 0, 4)
    storeUint8(array, id, 4, 8)
    storeUint8(array, checksum, 12, 8)
    if (buffer.length) {
      array.set(buffer, 20)
    }
    return array
  } else {
    console.warn('chunk not implemented yet')
    return new Uint8Array(0)
  }
}

export const encodeObservableDiffResponse = (
  id: number,
  checksum: number,
  previousChecksum: number,
  buffer: Buffer
): Uint8Array => {
  // Type 2 (diff data)
  // | 4 header | 8 id | 8 checksum | 8 previousChecksum | * diff |

  let isDeflate = false
  // implement later
  const chunks = 1

  if (buffer.length > 100) {
    isDeflate = true
    buffer = zlib.deflateRawSync(buffer, {})
  }

  if (chunks === 1) {
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
  } else {
    console.warn('chunk not implemented yet')
    return new Uint8Array(0)
  }
}

export const encodeAuthResponse = (id: number, buffer: Buffer): Uint8Array => {
  // Type 4
  // | 4 header | 3 id | * payload |

  let isDeflate = false

  if (buffer.length > 100) {
    isDeflate = true
    buffer = zlib.deflateRawSync(buffer, {})
  }

  const headerSize = 4
  const idSize = 3
  const msgSize = idSize + buffer.length
  const header = encodeHeader(4, isDeflate, msgSize)
  const array = new Uint8Array(headerSize + msgSize)
  storeUint8(array, header, 0, 4)
  storeUint8(array, id, 4, 3)
  if (buffer.length) {
    array.set(buffer, 7)
  }
  return array
}
