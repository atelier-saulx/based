import { crc32c } from '../../hash/index.js'
import { combineToNumber, readUint32 } from '../../utils/index.js'
import { Meta } from './types.js'

export const readMetaSeperate = (result: Uint8Array, i: number): Meta => {
  const compressed = result[i] === 1
  const crc32 = readUint32(result, i + 1)
  const size = readUint32(result, i + 5) - 6
  const checksum = combineToNumber(crc32, size)
  return { checksum, size, crc32, compressed }
}

export const readMetaMainString = (
  result: Uint8Array,
  i: number,
  len: number,
): Meta => {
  const crc32 = crc32c(result.subarray(i, i + len))
  const checksum = combineToNumber(crc32, len)
  return { checksum, size: len, crc32, compressed: false }
}

export const emptyMeta = (): Meta => {
  return {
    checksum: 0,
    size: 0,
    crc32: 0,
    compressed: false,
  }
}
