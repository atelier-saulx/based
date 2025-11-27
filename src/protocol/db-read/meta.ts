import { crc32c } from '../../hash/index.js'
import { combineToNumber } from '../../utils/index.js'
import { Meta } from './types.js'

export const readMetaMainString = (
  result: Uint8Array,
  i: number,
  len: number,
): Meta => {
  const crc32 = crc32c(result.subarray(i, i + len))
  const checksum = combineToNumber(crc32, len)
  return {
    checksum,
    size: len,
    crc32,
    compressed: false,
    compressedSize: len,
  }
}

export const emptyMeta = (): Meta => {
  return {
    checksum: 0,
    size: 0,
    crc32: 0,
    compressed: false,
    compressedSize: 0,
  }
}
