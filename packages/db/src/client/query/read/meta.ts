import { combineToNumber, readUint32 } from '@based/utils'
import { Meta } from './types.js'
import { crc32c } from '@based/hash'

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
