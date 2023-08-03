export function encodeLongLong(ll: number): Buffer {
  const iBuf = Buffer.allocUnsafe(8)
  iBuf.writeBigInt64LE(BigInt(ll))
  return iBuf
}

export function encodeDouble(d: number): Buffer {
  const dBuf = Buffer.allocUnsafe(8)
  dBuf.writeDoubleLE(d)
  return dBuf
}
