import { crc32c_table } from './crc32c_table.js'

export function crc32c(val: string | Uint8Array): number {
  let buf: Buffer
  if (typeof val === 'string') {
    buf = Buffer.allocUnsafe(Buffer.byteLength(val))
    buf.write(val)
  } else {
    buf = Buffer.from(val)
  }
  let crc = 0
  let offset = 0
  let len = buf.length

  if (len == 0) {
    return crc
  }

  while (len > 0 && offset % 8 !== 0) {
    crc = ((crc >>> 8) ^ crc32c_table[0][(crc ^ buf[offset]) & 0xff]) >>> 0
    offset++
    len--
  }

  const n = Math.floor(len / 8)
  for (let i = 0; i < n; i++) {
    // original c source uses uint64_t word
    // const word = BigInt(crc) ^ buf.readBigUInt64LE(offset)
    // split in tow to avoid bigint
    const wordLow = buf.readUInt32LE(offset)
    const wordHigh = buf.readUInt32LE(offset + 4)
    const newWordLow = crc ^ wordLow
    const newWordHigh = wordHigh

    const b0 = newWordLow & 0xff
    const b1 = (newWordLow >>> 8) & 0xff
    const b2 = (newWordLow >>> 16) & 0xff
    const b3 = (newWordLow >>> 24) & 0xff
    const b4 = newWordHigh & 0xff
    const b5 = (newWordHigh >>> 8) & 0xff
    const b6 = (newWordHigh >>> 16) & 0xff
    const b7 = (newWordHigh >>> 24) & 0xff

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

  while (len > 0) {
    crc = ((crc >>> 8) ^ crc32c_table[0][(crc ^ buf[offset]) & 0xff]) >>> 0
    offset++
    len--
  }

  return crc >>> 0
}
