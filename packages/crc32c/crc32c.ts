import { kCRCTable } from './crc32c_table.js'

/**
 * This code is a manual javascript translation of c code generated by
 * pycrc 0.7.1 (http://www.tty1.net/pycrc/). Command line used:
 * './pycrc.py --model=crc-32c --generate c --algorithm=table-driven'
 *
 * Adapted to use in Based.db  2025-02-17
 */

export function crc32c(val: String | Uint8Array | Buffer): number {
  let buf: Buffer
  let initial = 0

  if (typeof val === 'string') {
    buf = Buffer.allocUnsafe(Buffer.byteLength(val))
    buf.write(val)
  } else if (val instanceof Uint8Array) {
    buf = Buffer.from(val)
  } else if (Buffer.isBuffer(val)) {
    buf = val
  } else {
    buf = Buffer.from(val)
  }

  let crc = (initial | 0) ^ -1

  for (let i = 0; i < buf.length; i++) {
    crc = kCRCTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ -1) >>> 0
}
