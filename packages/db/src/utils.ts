import native from './native.js'

export const equals = (aB: Uint8Array, bB: Uint8Array): boolean => {
  const len = aB.byteLength
  if (len != bB.byteLength) {
    return false
  }
  let i = 0
  if (len < 40) {
    let max = len < 40 ? len : 4
    while (i < max) {
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
