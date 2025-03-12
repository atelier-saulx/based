import { LangCode } from '@based/schema'
import native from '../native.js'
import { readUint32 } from './bitWise.js'
import makeTmpBuffer from './tmpBuffer.js'

const DECODER = new TextDecoder('utf-8')
const ENCODER = new TextEncoder();

const { getUint8Array: getTmpBuffer } = makeTmpBuffer(4096) // the usual page size?

// type 0 = no compression; 1 = deflate
// [lang] [type] [uncompressed size 4] [compressed string] [crc32]

// var cnt = 0
// var bytesSaved = 0

// make this into a package
// write the type Byte
export const write = (
  buf: Buffer | Uint8Array,
  value: string,
  offset: number,
  noCompression: boolean,
  lang?: LangCode,
): number => {
  value = value.normalize('NFKD')

  buf[offset] = lang || 0
  const { written: l } = ENCODER.encodeInto(value, buf.subarray(offset + 2))
  let crc = native.crc32(buf.subarray(offset + 2, offset + 2 + l))

  // 50 maybe if lvl 1
  if (value.length > 200 && !noCompression) {
    buf.copyWithin(offset + 6 + l, offset + 2, offset + 2 + l)
    const size = native.compress(buf, offset + 6, l)
    if (size === 0) {
      buf[offset + 1] = 0 // not compressed
      ENCODER.encodeInto(value, buf.subarray(offset + 2))
      buf[offset + l + 2] = crc
      buf[offset + l + 3] = crc >>>= 8
      buf[offset + l + 4] = crc >>>= 8
      buf[offset + l + 5] = crc >>>= 8
      return l + 6
    } else {
      let len = l

      buf[offset + 1] = 1 // compressed

      buf[offset + 2] = len
      buf[offset + 3] = len >>>= 8
      buf[offset + 4] = len >>>= 8
      buf[offset + 5] = len >>>= 8

      buf[offset + size + 6] = crc
      buf[offset + size + 7] = crc >>>= 8
      buf[offset + size + 8] = crc >>>= 8
      buf[offset + size + 9] = crc >>>= 8
      return size + 10 // 0 C 4 4
    }
  } else {
    buf[offset + 1] = 0 // not compressed
    buf[offset + l + 2] = crc
    buf[offset + l + 3] = crc >>>= 8
    buf[offset + l + 4] = crc >>>= 8
    buf[offset + l + 5] = crc >>>= 8
    return l + 6
  }
}

let tmpCompressBlock: Buffer

export const compress = (str: string): Buffer => {
  const len = new TextEncoder().encode(str).byteLength
  if (!tmpCompressBlock || tmpCompressBlock.byteLength < len * 3) {
    tmpCompressBlock = Buffer.allocUnsafe(len * 3)
  }
  const l = write(tmpCompressBlock, str, 0, false)
  const nBuffer = Buffer.allocUnsafe(l)
  tmpCompressBlock.copy(nBuffer, 0, 0, l)
  return nBuffer
}

export const decompress = (val: Uint8Array): string => {
  return read(val, 0, val.length)
}

export const read = (val: Uint8Array, offset: number, len: number): string => {
  const type = val[offset + 1]
  if (type == 1) {
    const origSize = readUint32(val, offset + 2)
    const newBuffer = getTmpBuffer(origSize)
    // deflate in browser for this...
    native.decompress(val, newBuffer, offset + 6, len - 6)
    return DECODER.decode(newBuffer)
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
