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
