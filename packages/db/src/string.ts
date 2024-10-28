// type 0 = no compression; 1 = deflate
// [type] [uncompressed size 4] [compressed string] [crc32]

import { debug } from './query/debug.js'

export const write = (
  buf: Buffer,
  value: string,
  offset: number,
  noCompression: boolean,
): number => {
  if (value.length > 200 && !noCompression) {
    buf[offset] = 1
    buf.writeUint32LE(0, offset + 1)
    return 5 + buf.write(value, offset + 5, 'utf8')
  } else {
    buf[offset] = 0
    const size = 1 + buf.write(value, offset + 1, 'utf8')
    return size
  }
}

export const read = (buf: Buffer, offset: number, len: number): string => {
  const type = buf[offset]
  if (type == 1) {
    return buf.toString('utf8', offset + 5, len + offset)
  } else if (type == 0) {
    return buf.toString('utf8', offset + 1, len + offset)
  }
  return ''
}
