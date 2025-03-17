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
