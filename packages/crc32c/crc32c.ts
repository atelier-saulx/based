import { crc32c_table } from './crc32c_table'

export function crc32c(buf: Uint8Array): number {
  let crc = 0
  let offset = 0
  let len = buf.length

  // When the underlying buffer isn’t known to be aligned to 8 bytes,
  // we simulate the C code’s “while (len && ((uintptr_t)data & 7) != 0)”
  // by considering the byteOffset of the Uint8Array.
  const base = buf.byteOffset
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)

  // Process unaligned bytes until (base + offset) is a multiple of 8.
  while (len > 0 && (base + offset) % 8 !== 0) {
    crc = ((crc >>> 8) ^ crc32c_table[0][(crc ^ buf[offset]) & 0xff]) >>> 0
    offset++
    len--
  }

  // Process 8 bytes at a time.
  const n = Math.floor(len / 8)
  for (let i = 0; i < n; i++) {
    // Read an 8-byte (64-bit) little-endian word.
    // We use two 32-bit reads and combine them into a BigInt.
    const low = BigInt(dv.getUint32(offset, true))
    const high = BigInt(dv.getUint32(offset + 4, true))
    let word = (high << 32n) | low

    // XOR the lower 32 bits with the current crc.
    word = BigInt(crc) ^ word

    // Extract each byte from the 64-bit word.
    const b0 = Number(word & 0xffn)
    const b1 = Number((word >> 8n) & 0xffn)
    const b2 = Number((word >> 16n) & 0xffn)
    const b3 = Number((word >> 24n) & 0xffn)
    const b4 = Number((word >> 32n) & 0xffn)
    const b5 = Number((word >> 40n) & 0xffn)
    const b6 = Number((word >> 48n) & 0xffn)
    const b7 = Number((word >> 56n) & 0xffn)

    crc =
      (crc32c_table[7][b0] ^
        crc32c_table[6][b1] ^
        crc32c_table[5][b2] ^
        crc32c_table[4][b3] ^
        crc32c_table[3][b4] ^
        crc32c_table[2][b5] ^
        crc32c_table[1][b6] ^
        crc32c_table[0][b7]) >>>
      0

    offset += 8
  }

  len = len % 8

  // Process any len bytes one at a time.
  while (len > 0) {
    crc = ((crc >>> 8) ^ crc32c_table[0][(crc ^ buf[offset]) & 0xff]) >>> 0
    offset++
    len--
  }

  return crc >>> 0
}
