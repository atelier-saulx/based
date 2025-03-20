import {encodeBase64} from '@saulx/utils'

const native = (typeof window === 'undefined') ? (await import('./native.js')).default : null
export const DECODER = new TextDecoder('utf-8')
export const ENCODER = new TextEncoder()

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

export function concatUint8Arr(bufs: Uint8Array[], totalByteLength?: number): Uint8Array {
  totalByteLength = totalByteLength ?? bufs.reduce((acc, cur) => acc + cur.byteLength, 0)
  const res = new Uint8Array(totalByteLength)
  let off = 0

  for (let i = 0; i < bufs.length; i++) {
    const buf = bufs[i]

    res.set(buf, off)
    off += buf.byteLength
  }

  return res
}

const charMap = ENCODER.encode('0123456789abcdef');

// Uint8Array.fromHex() and Uint8Array.toHex() are not available in V8
// https://issues.chromium.org/issues/42204568
export const bufToHex = (a: Uint8Array): string => {
  const tmp = new Uint8Array(2 * a.byteLength)
  const n = charMap.length

  let j = 0;
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
  'a': 0xa,
  'b': 0xb,
  'c': 0xc,
  'd': 0xd,
  'e': 0xe,
  'f': 0xf,
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

  return buf;
}

function base64OutLen(n: number, lineMax: number): number
{
  let olen: number;

  /* This version would be with padding but we don't pad */
  //olen = n * 4 / 3 + 4; /* 3-byte blocks to 4-byte */
  olen = ((4 * n / 3) + 3) & ~3;
  olen += lineMax > 0 ? olen / lineMax : 0; // line feeds

  return olen;
}

export const base64encode = (a: Uint8Array, lineMax: number = 72): string => {
  // TODO Could fallback to @saulx/utils if native is not available
  const tmp = new Uint8Array(base64OutLen(a.byteLength, lineMax))

  if ((a.length < 10 && lineMax === 72) || !native) {
    return encodeBase64(a)
  } else {
    return DECODER.decode(native.base64encode(tmp, a, lineMax))
  }
}
