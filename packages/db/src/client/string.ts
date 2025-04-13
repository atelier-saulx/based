import { LangCode } from '@based/schema'
import native from '../native.js'
import { readUint32 } from './../utils.js'
import makeTmpBuffer from './tmpBuffer.js'
import { DECODER, ENCODER } from '../utils.js'

const { getUint8Array: getTmpBuffer } = makeTmpBuffer(4096) // the usual page size?

export const COMPRESSED = 1
export const NOT_COMPRESSED = 0

export const write = (
  buf: Uint8Array,
  value: string,
  offset: number,
  noCompression: boolean,
  lang?: LangCode,
): number => {
  value = value.normalize('NFKD')
  buf[offset] = lang || 0
  const { written: l } = ENCODER.encodeInto(value, buf.subarray(offset + 2))
  let crc = native.crc32(buf.subarray(offset + 2, offset + 2 + l))

  // 50 len maybe if lvl 1
  if (value.length > 200 && !noCompression) {
    buf.copyWithin(offset + 6 + l, offset + 2, offset + 2 + l)
    const size = native.compress(buf, offset + 6, l)
    if (size === 0) {
      buf[offset + 1] = NOT_COMPRESSED
      ENCODER.encodeInto(value, buf.subarray(offset + 2))
      buf[offset + l + 2] = crc
      buf[offset + l + 3] = crc >>>= 8
      buf[offset + l + 4] = crc >>>= 8
      buf[offset + l + 5] = crc >>>= 8
      return l + 6
    } else {
      let len = l

      buf[offset + 1] = COMPRESSED

      buf[offset + 2] = len
      buf[offset + 3] = len >>>= 8
      buf[offset + 4] = len >>>= 8
      buf[offset + 5] = len >>>= 8

      buf[offset + size + 6] = crc
      buf[offset + size + 7] = crc >>>= 8
      buf[offset + size + 8] = crc >>>= 8
      buf[offset + size + 9] = crc >>>= 8
      return size + 10
    }
  } else {
    buf[offset + 1] = NOT_COMPRESSED

    buf[offset + l + 2] = crc
    buf[offset + l + 3] = crc >>>= 8
    buf[offset + l + 4] = crc >>>= 8
    buf[offset + l + 5] = crc >>>= 8
    return l + 6
  }
}

export const compress = (str: string): Uint8Array => {
  const len = ENCODER.encode(str).byteLength
  const tmpCompressBlock = getTmpBuffer(len * 3)
  const l = write(tmpCompressBlock, str, 0, false)
  const nBuffer = new Uint8Array(l)
  nBuffer.set(tmpCompressBlock.subarray(0, l))
  return nBuffer
}

export const decompress = (val: Uint8Array): string => {
  return read(val, 0, val.length)
}

export const read = (val: Uint8Array, offset: number, len: number): string => {
  const type = val[offset + 1]
  if (type == COMPRESSED) {
    const origSize = readUint32(val, offset + 2)
    const newBuffer = getTmpBuffer(origSize)
    // Browser fallback required for this
    native.decompress(val, newBuffer, offset + 6, len - 6)
    return DECODER.decode(newBuffer)
  } else if (type == NOT_COMPRESSED) {
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
