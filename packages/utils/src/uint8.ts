export const DECODER = new TextDecoder('utf-8')
export const ENCODER = new TextEncoder()

// See if based db native (v1) is available - faster native methods
const basedNative =
  typeof window === 'undefined' ? global.__basedDb__native__ : null

export const equals = (aB: Uint8Array, bB: Uint8Array): boolean => {
  const len = aB.byteLength
  if (len != bB.byteLength) {
    return false
  }
  let i = 0
  if (len < 50 || !basedNative) {
    while (i < len) {
      if (aB[i] != bB[i]) {
        return false
      }
      i++
    }
    return true
  } else {
    while (i < 4) {
      if (aB[i] != bB[i]) {
        return false
      }
      i++
    }

    return basedNative.equals(aB, bB)
  }
}

export function concatUint8Arr(
  bufs: Uint8Array[],
  totalByteLength?: number,
): Uint8Array {
  totalByteLength =
    totalByteLength ?? bufs.reduce((acc, cur) => acc + cur.byteLength, 0)
  const res = new Uint8Array(totalByteLength)
  let off = 0

  for (let i = 0; i < bufs.length; i++) {
    const buf = bufs[i]

    res.set(buf, off)
    off += buf.byteLength
  }

  return res
}

const charMap = ENCODER.encode('0123456789abcdef')

// Uint8Array.fromHex() and Uint8Array.toHex() are not available in V8
// https://issues.chromium.org/issues/42204568
export const bufToHex = (a: Uint8Array): string => {
  const tmp = new Uint8Array(2 * a.byteLength)
  const n = charMap.length

  let j = 0
  for (let i = 0; i < a.byteLength; i++) {
    tmp[j++] = charMap[a[i] >>> 4 % n]
    tmp[j++] = charMap[a[i] & 0x0f % n]
  }

  return DECODER.decode(tmp)
}

const intMap = {
  '0': 0,
  '1': 0x1,
  '2': 0x2,
  '3': 0x3,
  '4': 0x4,
  '5': 0x5,
  '6': 0x6,
  '7': 0x7,
  '8': 0x8,
  '9': 0x9,
  a: 0xa,
  b: 0xb,
  c: 0xc,
  d: 0xd,
  e: 0xe,
  f: 0xf,
}

// Uint8Array.fromHex() and Uint8Array.toHex() are not available in V8
// https://issues.chromium.org/issues/42204568
export const hexToBuf = (s: string): Uint8Array => {
  const len = (s.length >>> 1) << 1
  const buf = new Uint8Array(len / 2)
  for (let i = 0; i < buf.byteLength; i++) {
    const x = s.charAt(2 * i)
    const y = s.charAt(2 * i + 1)
    buf[i] = (intMap[x] << 4) + intMap[y]
  }
  return buf
}

export const readDoubleLE = (val: Uint8Array, offset: number): number => {
  const low =
    (val[offset] |
      (val[offset + 1] << 8) |
      (val[offset + 2] << 16) |
      (val[offset + 3] << 24)) >>>
    0
  const high =
    (val[offset + 4] |
      (val[offset + 5] << 8) |
      (val[offset + 6] << 16) |
      (val[offset + 7] << 24)) >>>
    0
  const sign = high >>> 31 ? -1 : 1
  let exponent = (high >>> 20) & 0x7ff
  let fraction = (high & 0xfffff) * 2 ** 32 + low
  if (exponent === 0x7ff) {
    if (fraction === 0) return sign * Infinity
    return NaN
  }
  if (exponent === 0) {
    if (fraction === 0) return sign * 0
    exponent = 1
  } else {
    fraction += 2 ** 52
  }
  return sign * fraction * 2 ** (exponent - 1075)
}

export const readFloatLE = (val: Uint8Array, offset: number): number => {
  const bits =
    val[offset] |
    (val[offset + 1] << 8) |
    (val[offset + 2] << 16) |
    (val[offset + 3] << 24)
  const sign = bits >>> 31 ? -1 : 1
  let exponent = (bits >>> 23) & 0xff
  let fraction = bits & 0x7fffff
  if (exponent === 0xff) {
    if (fraction === 0) return sign * Infinity
    return NaN
  }
  if (exponent === 0) {
    if (fraction === 0) return sign * 0
    exponent = 1
  } else {
    fraction |= 0x800000
  }
  return sign * fraction * 2 ** (exponent - 150)
}

export const writeUint16 = (dest: Uint8Array, val: number, offset: number) => {
  dest[offset] = val
  dest[offset + 1] = val >>> 8
}

export const writeInt16 = writeUint16

export const writeUint24 = (dest: Uint8Array, val: number, offset: number) => {
  dest[offset] = val
  dest[offset + 1] = val >>> 8
  dest[offset + 2] = val >>> 16
}

export const writeInt24 = writeUint24

export const writeUint32 = (dest: Uint8Array, val: number, offset: number) => {
  dest[offset + 0] = val
  dest[offset + 1] = val >>> 8
  dest[offset + 2] = val >>> 16
  dest[offset + 3] = val >>> 24
}

export const writeUint64 = (dest: Uint8Array, val: number, offset: number) => {
  const byte0 = val & 0xff
  dest[offset + 0] = byte0
  val = (val - byte0) / 256
  const byte1 = val & 0xff
  dest[offset + 1] = byte1
  val = (val - byte1) / 256
  const byte2 = val & 0xff
  dest[offset + 2] = byte2
  val = (val - byte2) / 256
  const byte3 = val & 0xff
  dest[offset + 3] = byte3
  val = (val - byte3) / 256
  const byte4 = val & 0xff
  dest[offset + 4] = byte4
  val = (val - byte4) / 256
  const byte5 = val & 0xff
  dest[offset + 5] = byte5
  val = (val - byte5) / 256
  const byte6 = val & 0xff
  dest[offset + 6] = byte6
  val = (val - byte6) / 256
  const byte7 = val & 0xff
  dest[offset + 7] = byte7
}

export const readUint64 = (src: Uint8Array, offset: number) => {
  let n = src[offset + 7]
  n = n * 256 + src[offset + 6]
  n = n * 256 + src[offset + 5]
  n = n * 256 + src[offset + 4]
  n = n * 256 + src[offset + 3]
  n = n * 256 + src[offset + 2]
  n = n * 256 + src[offset + 1]
  n = n * 256 + src[offset + 0]
  return n
}

export const writeInt64 = (dest: Uint8Array, val: number, offset: number) => {
  // Use DataView for negative values to ensure precision
  if (val < 0) {
    const view = new DataView(dest.buffer, offset, 8)
    view.setBigInt64(0, BigInt(val), true)
  } else {
    const byte0 = val & 0xff
    dest[offset + 0] = byte0
    val = (val - byte0) / 256
    const byte1 = val & 0xff
    dest[offset + 1] = byte1
    val = (val - byte1) / 256
    const byte2 = val & 0xff
    dest[offset + 2] = byte2
    val = (val - byte2) / 256
    const byte3 = val & 0xff
    dest[offset + 3] = byte3
    val = (val - byte3) / 256
    const byte4 = val & 0xff
    dest[offset + 4] = byte4
    val = (val - byte4) / 256
    const byte5 = val & 0xff
    dest[offset + 5] = byte5
    val = (val - byte5) / 256
    const byte6 = val & 0xff
    dest[offset + 6] = byte6
    val = (val - byte6) / 256
    const byte7 = val & 0xff
    dest[offset + 7] = byte7
  }
}

export const readInt64 = (src: Uint8Array, offset: number): number => {
  // Check the sign bit first without doing full arithmetic
  if (src[offset + 7] & 0x80) {
    // Use DataView for negative values to ensure precision
    const view = new DataView(src.buffer, offset, 8)
    const result = view.getBigInt64(0, true) // true for little-endian
    return Number(result)
  }
  let n = src[offset + 7]
  n = n * 256 + src[offset + 6]
  n = n * 256 + src[offset + 5]
  n = n * 256 + src[offset + 4]
  n = n * 256 + src[offset + 3]
  n = n * 256 + src[offset + 2]
  n = n * 256 + src[offset + 1]
  n = n * 256 + src[offset + 0]
  return n
}

export const writeDoubleLE = (
  dest: Uint8Array,
  val: number,
  offset: number,
) => {
  const dV = new DataView(dest.buffer, offset)
  dV.setFloat64(0, val, true)
}

export const writeFloatLE = (dest: Uint8Array, val: number, offset: number) => {
  const dV = new DataView(dest.buffer, offset)
  dV.setFloat32(0, val, true)
}

export const writeInt32 = writeUint32

export const readUint32 = (val: Uint8Array, offset: number): number => {
  return (
    (val[offset] |
      (val[offset + 1] << 8) |
      (val[offset + 2] << 16) |
      (val[offset + 3] << 24)) >>>
    0
  )
}

export const readInt32 = (val: Uint8Array, offset: number): number => {
  return (
    val[offset] |
    (val[offset + 1] << 8) |
    (val[offset + 2] << 16) |
    (val[offset + 3] << 24)
  )
}

export const readUint24 = (val: Uint8Array, offset: number): number => {
  return (val[offset] | (val[offset + 1] << 8) | (val[offset + 2] << 16)) >>> 0
}

export const readInt24 = (val: Uint8Array, offset: number): number => {
  return val[offset] | (val[offset + 1] << 8) | (val[offset + 2] << 16)
}

export const readInt16 = (val: Uint8Array, offset: number): number => {
  return ((val[offset] | (val[offset + 1] << 8)) << 16) >> 16
}

export const readUint16 = (val: Uint8Array, offset: number): number => {
  return (val[offset] | (val[offset + 1] << 8)) >>> 0
}

export const makeTmpBuffer = (initialSize: number) => {
  // @ts-ignore
  let tmpBuffer = new ArrayBuffer(initialSize, { maxByteLength: initialSize })
  return {
    getUint8Array: (size: number): Uint8Array => {
      const opts = {
        maxByteLength: Math.min(Math.round(1.5 * size), 274877906944),
      }
      // @ts-ignore
      if (tmpBuffer.maxByteLength < size) {
        // @ts-ignore
        tmpBuffer = new ArrayBuffer(size, opts)
      }
      // @ts-ignore
      tmpBuffer.resize(size)

      return new Uint8Array(tmpBuffer)
    },
  }
}

const calculateHash32 = (uint8Array: Uint8Array, seed = 0) => {
  let hash = seed
  const prime1 = 31
  const prime2 = 17
  for (let i = 0; i < uint8Array.length; i++) {
    hash = (hash * prime1) ^ uint8Array[i]
    hash = (hash * prime2) & 0xffffffff
  }
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x85ebca6b)
  hash ^= hash >>> 13
  hash = Math.imul(hash, 0xc2b2ae35)
  hash ^= hash >>> 16
  return hash >>> 0
}

export const hashUint8Array = (uint8Array: Uint8Array) => {
  const seed1 = 0xabcdef01
  const seed2 = 0x10fedcba
  const hashPart1 = calculateHash32(uint8Array, seed1)
  const hashPart2 = calculateHash32(uint8Array, seed2)
  const highBitsContribution = Number(hashPart1) * 2097152
  const lowBitsContribution = hashPart2 >>> 11
  const result = highBitsContribution + lowBitsContribution
  return result
}

const BITS_FOR_B = 21
const FACTOR = 2 ** BITS_FOR_B
const MASK_B = FACTOR - 1

export const combineToNumber = (a: number, b: number): number => {
  const val1_unsigned = a >>> 0
  const truncated_b = b & MASK_B
  const shifted_a = val1_unsigned * FACTOR
  return shifted_a + truncated_b
}
