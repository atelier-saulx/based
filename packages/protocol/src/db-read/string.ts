// import native from '../native.js'
import { readUint32, makeTmpBuffer, DECODER } from '@based/utils'
import { COMPRESSED, NOT_COMPRESSED } from './types.js'
import { inflateSync } from 'fflate'

// const { getUint8Array: getTmpBuffer } = makeTmpBuffer(4096) // the usual page size?

let tmpBuffer = new Uint8Array(4096)
const getTmpBuffer = (len: number) => {
  if (len > tmpBuffer.byteLength) {
    tmpBuffer = new Uint8Array(len)
  }
  if (len === tmpBuffer.byteLength) {
    return tmpBuffer
  }
  return tmpBuffer.subarray(0, len)
}

export const decompress = (val: Uint8Array): string => {
  return readString(val, 0, val.length, false)
}

const inflate = global.__basedDb__native__
  ? global.__basedDb__native__.decompress
  : (input: Uint8Array, output: Uint8Array, offset: number, len: number) => {
      return inflateSync(input.subarray(offset, offset + len), { out: output })
    }

export const readString = (
  val: Uint8Array,
  offset: number,
  len: number,
  strippedCrc32: boolean,
): string => {
  const type = val[offset + 1]
  if (type == COMPRESSED) {
    const origSize = readUint32(val, offset + 2)
    const newBuffer = getTmpBuffer(origSize)
    // Browser fallback required for this
    inflate(val, newBuffer, offset + 6, strippedCrc32 ? len - 2 : len - 6)
    return DECODER.decode(newBuffer)
  } else if (type == NOT_COMPRESSED) {
    if (strippedCrc32) {
      return DECODER.decode(val.subarray(offset + 2, len + offset))
    } else {
      return DECODER.decode(val.subarray(offset + 2, len + offset - 4))
    }
  }
  return ''
}
