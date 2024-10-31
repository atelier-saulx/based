// type 0 = no compression; 1 = deflate
// [type] [uncompressed size 4] [compressed string] [crc32]

import native from './native.js'

// make this into a package
// write the type Byte
export const write = (
  buf: Buffer,
  value: string,
  offset: number,
  noCompression: boolean,
): number => {
  if (value.length > 150 && !noCompression) {
    buf[offset] = 1
    const s = Buffer.byteLength(value, 'utf8')
    // TODO: we need this also has to be added in modify s * 2
    // pass this to here
    buf.write(value, offset + 5 + s, 'utf8')
    const size = native.compress(buf, offset + 5, s)
    if (size === 0) {
      buf[offset] = 0
      return 1 + buf.write(value, offset + 5, 'utf8')
    } else {
      buf.writeUInt32LE(s, offset + 1)
      return size + 5
    }
  } else {
    // Buffer.byteLength(value, 'utf8')
    buf[offset] = 0
    const size = 1 + buf.write(value, offset + 1, 'utf8')
    return size
  }
}

let tmpCompressBlock: Buffer

export const compress = (str: string): Buffer => {
  if (!tmpCompressBlock || tmpCompressBlock.byteLength < str.length * 2) {
    tmpCompressBlock = Buffer.allocUnsafe(str.length * 2)
  }
  const s = write(tmpCompressBlock, str, 0, false)
  const nBuffer = Buffer.allocUnsafe(s)
  tmpCompressBlock.copy(nBuffer, 0, 0, s)
  return nBuffer
}

export const decompress = (buf: Buffer): string => {
  // read uncompressed
  return 'derp'
}

export const read = (buf: Buffer, offset: number, len: number): string => {
  const type = buf[offset]
  if (type == 1) {
    const origSize = buf.readUint32LE(offset + 1)
    const newBuffer = Buffer.allocUnsafe(origSize)
    native.decompress(buf, newBuffer, offset + 5, len - 5)
    return newBuffer.toString('utf8')
  } else if (type == 0) {
    return buf.toString('utf8', offset + 1, len + offset)
  }
  return ''
}
