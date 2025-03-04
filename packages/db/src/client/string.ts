import { LangCode } from '@based/schema'
import native from '../native.js'
import { readUint32 } from './bitWise.js'

const DECODER = new TextDecoder('utf-8')
// add encoder

// type 0 = no compression; 1 = deflate
// [lang] [type] [uncompressed size 4] [compressed string] [crc32]

// var cnt = 0
// var bytesSaved = 0

// make this into a package
// write the type Byte
export const write = (
  buf: Buffer,
  value: string,
  offset: number,
  noCompression: boolean,
  lang?: LangCode,
): number => {
  value = value.normalize('NFKD')
  buf[offset] = lang || 0
  // 50 maybe if lvl 1
  if (value.length > 200 && !noCompression) {
    const s = Buffer.byteLength(value, 'utf8')
    buf.write(value, offset + 6 + s, 'utf8')
    let crc = native.crc32(buf.subarray(offset + 6 + s, offset + 6 + 2 * s))
    const size = native.compress(buf, offset + 6, s)
    if (size === 0) {
      buf[offset + 1] = 0 // not compressed
      const len = buf.write(value, offset + 2, 'utf8')
      buf[offset + len + 2] = crc
      buf[offset + len + 3] = crc >>>= 8
      buf[offset + len + 4] = crc >>>= 8
      buf[offset + len + 5] = crc >>>= 8
      return len + 6
    } else {
      buf[offset + 1] = 1 // compressed
      buf.writeUInt32LE(s, offset + 2)
      buf[offset + size + 6] = crc
      buf[offset + size + 7] = crc >>>= 8
      buf[offset + size + 8] = crc >>>= 8
      buf[offset + size + 9] = crc >>>= 8
      return size + 10 // 0 C 4 4
    }
  } else {
    buf[offset + 1] = 0 // not compressed
    const len = buf.write(value, offset + 2, 'utf8')
    let crc = native.crc32(buf.subarray(offset + 2, offset + len + 2))
    buf[offset + len + 2] = crc
    buf[offset + len + 3] = crc >>>= 8
    buf[offset + len + 4] = crc >>>= 8
    buf[offset + len + 5] = crc >>>= 8
    return len + 6
  }
}

let tmpCompressBlock: Buffer

export const compress = (str: string): Buffer => {
  if (!tmpCompressBlock || tmpCompressBlock.byteLength < str.length * 3) {
    tmpCompressBlock = Buffer.allocUnsafe(str.length * 3)
  }
  const s = write(tmpCompressBlock, str, 0, false)
  const nBuffer = Buffer.allocUnsafe(s)
  tmpCompressBlock.copy(nBuffer, 0, 0, s)
  return nBuffer
}

export const decompress = (val: Uint8Array): string => {
  return read(val, 0, val.length)
}

export const read = (val: Uint8Array, offset: number, len: number): string => {
  const type = val[offset + 1]
  if (type == 1) {
    const origSize = readUint32(val, offset + 2)
    const newBuffer = Buffer.allocUnsafe(origSize)
    // deflate in browser for this...
    native.decompress(Buffer.from(val), newBuffer, offset + 6, len - 6)
    return newBuffer.toString('utf8')
  } else if (type == 0) {
    return DECODER.decode(val.subarray(offset + 2, len + offset - 4))
  }
  return ''
}

export const readUtf8 = (
  val: Uint8Array,
  offset: number,
  len: number,
): string => {
  return DECODER.decode(val.subarray(offset, len + offset))
}
