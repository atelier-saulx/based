import { inspect } from 'node:util'
import picocolors from 'picocolors'
import { DbServer } from './server/index.js'

const native =
  typeof window === 'undefined' ? (await import('./native.js')).default : null
export const DECODER = new TextDecoder('utf-8')
export const ENCODER = new TextEncoder()

export const debugMode = (target, getInfo = null) => {
  const opts = { showHidden: false, depth: null, colors: true }
  const info = (v) => (typeof v === 'object' ? inspect(v, opts) : v)
  const proto = target.constructor.prototype
  const keys = new Set([
    ...Object.keys(Object.getOwnPropertyDescriptors(proto)),
    ...Object.keys(target),
  ])
  const colors = [
    'red',
    'green',
    'yellow',
    'blue',
    'magenta',
    'cyan',
    'redBright',
    'greenBright',
    'yellowBright',
    'blueBright',
    'magentaBright',
    'cyanBright',
  ]
  let colorKey = 0
  for (const key of keys) {
    const fn = target[key]
    if (typeof fn === 'function') {
      let cnt = 0

      const color = colors[colorKey++ % colors.length]
      target[key] = function () {
        const arr = [picocolors[color](`[${key}:${++cnt}]`)]
        const add = getInfo?.(key)
        if (add) arr.push(add)
        arr.push(...arguments)
        console.info(arr.map(info).join(' '))
        return fn.apply(target, arguments)
      }
    }
  }
}

export const debugServer = (server: DbServer) =>
  debugMode(
    server,
    () =>
      `p: ${server.processingQueries} m: ${server.modifyQueue.length} q: ${server.queryQueue.size}`,
  )

export const equals = (aB: Uint8Array, bB: Uint8Array): boolean => {
  const len = aB.byteLength
  if (len != bB.byteLength) {
    return false
  }
  let i = 0
  if (len < 50 || !native) {
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

    return native.equals(aB, bB)
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

export const readInt16 = (val: Uint8Array, offset: number): number => {
  return ((val[offset] | (val[offset + 1] << 8)) << 16) >> 16
}

export const readUint16 = (val: Uint8Array, offset: number): number => {
  return (val[offset] | (val[offset + 1] << 8)) >>> 0
}
