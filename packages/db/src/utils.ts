import native from './native.js'

export const equals = (aB: Uint8Array, bB: Uint8Array): boolean => {
  const len = aB.byteLength
  if (len != bB.byteLength) {
    return false
  }
  let i = 0
  if (len < 50) {
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

const charMap = new TextEncoder().encode("0123456789abcdef");
const DECODER = new TextDecoder()

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
